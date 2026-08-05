import crypto from "crypto";
import { Request, Response } from "express";
import { z } from "zod";
import { env } from "../config/env";
import { Order } from "../models/Order";
import { Payment } from "../models/Payment";
import { listLocalOrders, updateLocalOrder } from "../services/localOrderStore";
import {
  findOrderForTracking,
  orderTrackingRoom,
  toPublicOrderTracking,
  withoutOrderTrackingSecret
} from "../services/orderTrackingService";
import { createInAppNotification } from "../services/inAppNotificationService";
import { getRazorpayClient } from "../services/razorpayService";
import {
  reconcileRazorpayRefund,
  type RefundStatus
} from "../services/refundService";

const checkoutSchema = z.object({
  orderNumber: z.string().trim().regex(/^[A-Za-z0-9-]{4,64}$/),
  trackingToken: z.string().trim().min(32).max(128)
});

const paymentVerificationSchema = checkoutSchema.extend({
  razorpayOrderId: z.string().trim().min(1).max(200),
  razorpayPaymentId: z.string().trim().min(1).max(200),
  razorpaySignature: z.string().trim().regex(/^[a-fA-F0-9]{64}$/)
});

const paymentWebhookSchema = z.object({
  event: z.enum(["payment.captured", "payment.failed"]),
  payload: z.object({
    payment: z.object({
      entity: z.object({
        id: z.string().trim().min(1),
        order_id: z.string().trim().min(1),
        amount: z.coerce.number().int().positive(),
        currency: z.string().trim(),
        status: z.string().trim()
      })
    })
  })
});

const refundWebhookSchema = z.object({
  event: z.enum(["refund.created", "refund.processed", "refund.failed"]),
  payload: z.object({
    refund: z.object({
      entity: z.object({
        id: z.string().trim().min(1),
        payment_id: z.string().trim().min(1),
        amount: z.coerce.number().int().positive(),
        currency: z.string().trim(),
        status: z.string().trim()
      })
    })
  })
});

type PaymentOrderRecord = {
  id?: string;
  _id?: unknown;
  customer?: unknown;
  orderNumber: string;
  total: number;
  status: string;
  orderType: "delivery" | "takeaway" | "dine_in";
  paymentMethod?: string;
  paymentStatus?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  statusHistory?: Array<{ status: string; at: string | Date }>;
};

function secureTextMatch(first: string, second: string) {
  const firstBuffer = Buffer.from(first, "utf8");
  const secondBuffer = Buffer.from(second, "utf8");
  return firstBuffer.length === secondBuffer.length &&
    crypto.timingSafeEqual(firstBuffer, secondBuffer);
}

function paymentSignature(orderId: string, paymentId: string) {
  return crypto
    .createHmac("sha256", env.razorpayKeySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
}

function amountInPaise(order: PaymentOrderRecord) {
  const amount = Math.round(Number(order.total) * 100);
  return Number.isFinite(amount) ? amount : 0;
}

async function saveProviderOrder(
  order: PaymentOrderRecord,
  providerOrderId: string,
  amount: number
) {
  if (Order.db.readyState === 1) {
    const updatedResult = await Order.findOneAndUpdate(
      { orderNumber: order.orderNumber },
      { $set: { razorpayOrderId: providerOrderId } },
      { new: true }
    ).lean();
    if (!updatedResult) throw new Error("Order not found");
    const updated = updatedResult as unknown as PaymentOrderRecord & {
      _id: unknown;
    };

    await Payment.findOneAndUpdate(
      { order: updated._id, provider: "razorpay" },
      {
        $set: {
          providerOrderId,
          amount,
          currency: "INR",
          status: "created"
        },
        $setOnInsert: { webhookEventIds: [] }
      },
      { upsert: true, runValidators: true }
    );
    return;
  }

  await updateLocalOrder(order.orderNumber, { razorpayOrderId: providerOrderId });
}

async function findOrderByProviderOrderId(providerOrderId: string) {
  if (Order.db.readyState === 1) {
    return await Order.findOne({ razorpayOrderId: providerOrderId }).lean() as
      | PaymentOrderRecord
      | null;
  }

  return (await listLocalOrders()).find(
    (order) => order.razorpayOrderId === providerOrderId
  ) ?? null;
}

async function markOrderPaid(
  order: PaymentOrderRecord,
  providerOrderId: string,
  providerPaymentId: string,
  eventId?: string
) {
  const now = new Date();
  const nextStatus = order.orderType === "dine_in" ? "pending" : "placed";
  const shouldAdvance = order.status === "pending" && nextStatus !== order.status;

  if (Order.db.readyState === 1) {
    const update = {
      $set: {
        paymentStatus: "paid",
        razorpayPaymentId: providerPaymentId,
        ...(shouldAdvance ? { status: nextStatus } : {})
      },
      ...(shouldAdvance
        ? { $push: { statusHistory: { status: nextStatus, at: now } } }
        : {})
    };
    const updatedResult = await Order.findOneAndUpdate(
      { orderNumber: order.orderNumber, razorpayOrderId: providerOrderId },
      update,
      { new: true, runValidators: true }
    ).lean();
    if (!updatedResult) throw new Error("Payment order does not match the restaurant order");
    const updated = updatedResult as unknown as PaymentOrderRecord & {
      _id: unknown;
    };

    await Payment.findOneAndUpdate(
      { order: updated._id, provider: "razorpay" },
      {
        $set: {
          providerOrderId,
          providerPaymentId,
          amount: amountInPaise(order),
          currency: "INR",
          status: "verified",
          rawPayload: { providerPaymentId, status: "captured" }
        },
        ...(eventId ? { $addToSet: { webhookEventIds: eventId } } : {})
      },
      { upsert: true, runValidators: true }
    );
    return updated;
  }

  return updateLocalOrder(order.orderNumber, {
    paymentStatus: "paid",
    razorpayOrderId: providerOrderId,
    razorpayPaymentId: providerPaymentId,
    ...(shouldAdvance
      ? {
          status: nextStatus,
          statusHistory: [
            ...(order.statusHistory ?? []).map((entry) => ({
              status: entry.status,
              at: entry.at instanceof Date ? entry.at.toISOString() : entry.at
            })),
            { status: nextStatus, at: now.toISOString() }
          ]
        }
      : {})
  });
}

async function markOrderPaymentFailed(
  order: PaymentOrderRecord,
  providerPaymentId: string,
  eventId?: string
) {
  if (order.paymentStatus === "paid") return order;

  if (Order.db.readyState === 1) {
    const updatedResult = await Order.findOneAndUpdate(
      { orderNumber: order.orderNumber, paymentStatus: { $ne: "paid" } },
      { $set: { paymentStatus: "failed", razorpayPaymentId: providerPaymentId } },
      { new: true, runValidators: true }
    ).lean();
    if (!updatedResult) return order;
    const updated = updatedResult as unknown as PaymentOrderRecord & {
      _id: unknown;
    };

    await Payment.findOneAndUpdate(
      { order: updated._id, provider: "razorpay" },
      {
        $set: {
          providerOrderId: order.razorpayOrderId,
          providerPaymentId,
          amount: amountInPaise(order),
          currency: "INR",
          status: "failed",
          rawPayload: { providerPaymentId, status: "failed" }
        },
        ...(eventId ? { $addToSet: { webhookEventIds: eventId } } : {})
      },
      { upsert: true, runValidators: true }
    );
    return updated;
  }

  return updateLocalOrder(order.orderNumber, {
    paymentStatus: "failed",
    razorpayPaymentId: providerPaymentId
  });
}

function emitOrderPaymentUpdate(req: Request, order: unknown) {
  const update = toPublicOrderTracking(order);
  const io = req.app.get("io");
  if (!io) return;
  io.to(orderTrackingRoom(update.orderNumber)).emit("order:status", update);
  io.to("orders:staff").emit("order_updated", update);
}

function paymentCustomerId(order: unknown) {
  const customer = (order as { customer?: unknown })?.customer;
  if (!customer) return undefined;
  if (typeof customer === "object" && "_id" in customer) {
    return String((customer as { _id: unknown })._id);
  }
  return String(customer);
}

async function notifyPaymentResult(
  req: Request,
  order: PaymentOrderRecord,
  status: "paid" | "failed",
  providerPaymentId: string
) {
  const customerId = paymentCustomerId(order);
  if (!customerId) return;
  await createInAppNotification(
    {
      audience: "customer",
      recipient: customerId,
      type: "payment",
      title: status === "paid" ? "Payment confirmed" : "Payment failed",
      message: status === "paid"
        ? `Payment for ${order.orderNumber} was verified successfully.`
        : `Payment for ${order.orderNumber} was not completed.`,
      href: "/orders",
      orderNumber: order.orderNumber,
      dedupeKey: `customer:${customerId}:payment:${providerPaymentId}:${status}`
    },
    req.app.get("io")
  );
}

export async function createRazorpayOrder(req: Request, res: Response) {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payment request" });
  }

  const razorpay = getRazorpayClient();
  if (!razorpay) {
    return res.status(503).json({
      message: "Online payment is not configured. Please choose cash on delivery."
    });
  }

  const order = await findOrderForTracking(
    parsed.data.orderNumber,
    parsed.data.trackingToken
  ) as PaymentOrderRecord | null;
  if (!order || order.paymentMethod !== "razorpay") {
    return res.status(404).json({ message: "Payment order was not found" });
  }
  if (order.paymentStatus === "paid") {
    return res.status(409).json({ message: "This order is already paid" });
  }

  const amount = amountInPaise(order);
  if (amount < 1 || amount > 100_000_000) {
    return res.status(400).json({ message: "The order total cannot be paid online" });
  }

  const providerOrder = await razorpay.orders.create({
    amount,
    currency: "INR",
    receipt: order.orderNumber.slice(0, 40),
    notes: { restaurantOrderNumber: order.orderNumber }
  });
  await saveProviderOrder(order, providerOrder.id, amount);

  return res.status(201).json({
    keyId: env.razorpayKeyId,
    orderId: providerOrder.id,
    amount,
    currency: "INR"
  });
}

export async function verifyRazorpayPayment(req: Request, res: Response) {
  const parsed = paymentVerificationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payment verification" });
  }

  const razorpay = getRazorpayClient();
  if (!razorpay) {
    return res.status(503).json({ message: "Online payment is not configured" });
  }

  const order = await findOrderForTracking(
    parsed.data.orderNumber,
    parsed.data.trackingToken
  ) as PaymentOrderRecord | null;
  if (!order || order.razorpayOrderId !== parsed.data.razorpayOrderId) {
    return res.status(404).json({ message: "Payment order was not found" });
  }

  const expectedSignature = paymentSignature(
    parsed.data.razorpayOrderId,
    parsed.data.razorpayPaymentId
  );
  if (!secureTextMatch(parsed.data.razorpaySignature, expectedSignature)) {
    return res.status(400).json({ message: "Payment signature verification failed" });
  }

  let providerPayment = await razorpay.payments.fetch(
    parsed.data.razorpayPaymentId
  );
  if (providerPayment.status === "authorized") {
    providerPayment = await razorpay.payments.capture(
      parsed.data.razorpayPaymentId,
      amountInPaise(order),
      "INR"
    );
  }

  if (
    providerPayment.order_id !== parsed.data.razorpayOrderId ||
    Number(providerPayment.amount) !== amountInPaise(order) ||
    providerPayment.currency !== "INR" ||
    providerPayment.status !== "captured"
  ) {
    return res.status(409).json({
      message: "The payment has not been captured for the correct order total"
    });
  }

  const updated = await markOrderPaid(
    order,
    parsed.data.razorpayOrderId,
    parsed.data.razorpayPaymentId
  );
  if (!updated) {
    return res.status(500).json({ message: "Unable to confirm the payment" });
  }
  emitOrderPaymentUpdate(req, updated);
  await notifyPaymentResult(
    req,
    updated as PaymentOrderRecord,
    "paid",
    parsed.data.razorpayPaymentId
  );
  return res.json({ order: withoutOrderTrackingSecret(updated) });
}

export async function verifyRazorpayWebhook(req: Request, res: Response) {
  const signature = req.headers["x-razorpay-signature"];
  const eventId = req.headers["x-razorpay-event-id"];
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;

  if (!env.razorpayWebhookSecret) {
    return res.status(503).json({ message: "Razorpay webhook is not configured" });
  }
  if (typeof signature !== "string" || !rawBody) {
    return res.status(400).json({ message: "Invalid webhook signature" });
  }

  const expected = crypto
    .createHmac("sha256", env.razorpayWebhookSecret)
    .update(rawBody)
    .digest("hex");
  if (!secureTextMatch(signature, expected)) {
    return res.status(400).json({ message: "Invalid webhook signature" });
  }

  const webhookEventId = typeof eventId === "string" && eventId.trim()
    ? eventId.trim().slice(0, 200)
    : crypto.createHash("sha256").update(rawBody).digest("hex");

  const paymentEvent = paymentWebhookSchema.safeParse(req.body);
  if (paymentEvent.success) {
    const payment = paymentEvent.data.payload.payment.entity;
    const order = await findOrderByProviderOrderId(payment.order_id);
    if (!order) return res.status(202).json({ received: true, handled: false });

    if (Order.db.readyState === 1) {
      const duplicate = await Payment.exists({
        providerOrderId: payment.order_id,
        webhookEventIds: webhookEventId
      });
      if (duplicate) {
        return res.json({ received: true, handled: true, duplicate: true });
      }
    }

    let updated;
    if (
      paymentEvent.data.event === "payment.captured" &&
      payment.status === "captured" &&
      payment.currency === "INR" &&
      payment.amount === amountInPaise(order)
    ) {
      updated = await markOrderPaid(
        order,
        payment.order_id,
        payment.id,
        webhookEventId
      );
    } else if (paymentEvent.data.event === "payment.failed") {
      updated = await markOrderPaymentFailed(
        order,
        payment.id,
        webhookEventId
      );
    }

    if (updated) {
      emitOrderPaymentUpdate(req, updated);
      await notifyPaymentResult(
        req,
        updated as PaymentOrderRecord,
        paymentEvent.data.event === "payment.captured" ? "paid" : "failed",
        payment.id
      );
    }
    return res.json({ received: true, handled: Boolean(updated) });
  }

  const refundEvent = refundWebhookSchema.safeParse(req.body);
  if (!refundEvent.success) {
    return res.status(202).json({ received: true, handled: false });
  }

  const refund = refundEvent.data.payload.refund.entity;
  if (refund.currency !== "INR") {
    return res.status(202).json({ received: true, handled: false });
  }
  const refundStatus: RefundStatus = refundEvent.data.event === "refund.failed"
    ? "failed"
    : refundEvent.data.event === "refund.processed" || refund.status === "processed"
      ? "processed"
      : "pending";
  const reconciled = await reconcileRazorpayRefund({
    providerRefundId: refund.id,
    providerPaymentId: refund.payment_id,
    amountPaise: refund.amount,
    status: refundStatus,
    eventId: webhookEventId,
    rawPayload: req.body
  });
  if (!reconciled) {
    return res.status(202).json({ received: true, handled: false });
  }

  if (reconciled.order) emitOrderPaymentUpdate(req, reconciled.order);
  if (reconciled.issue) {
    const issueId = String(
      (reconciled.issue as { _id?: unknown; id?: unknown })._id ??
      (reconciled.issue as { id?: unknown }).id ?? ""
    );
    const io = req.app.get("io");
    if (io && issueId) {
      io.to(`support:${issueId}`).emit("support_issue_updated", reconciled.issue);
      io.to("support:admins").emit("support_issue_updated", reconciled.issue);
    }
  }
  return res.json({ received: true, handled: true });
}
