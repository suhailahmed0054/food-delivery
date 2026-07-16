import { Issue } from "../models/Issue";
import { Order } from "../models/Order";
import { Payment } from "../models/Payment";
import { Refund } from "../models/Refund";
import { listLocalOrders, updateLocalOrder } from "./localOrderStore";
import { getRazorpayClient } from "./razorpayService";

export type RefundStatus = "pending" | "processed" | "failed";

export type RefundOrderRecord = {
  id?: string;
  _id?: unknown;
  orderNumber: string;
  total: number;
  paymentMethod?: string;
  paymentStatus?: string;
  razorpayPaymentId?: string;
  refundStatus?: string;
  refundAmount?: number;
  razorpayRefundId?: string;
};

export type RefundResult = {
  providerRefundId: string;
  amount: number;
  status: RefundStatus;
};

type StoredRefundRecord = {
  providerRefundId?: string;
  amount: number;
  status?: string;
  errorMessage?: string;
};

export class RefundProcessingError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "RefundProcessingError";
  }
}

function normalizeRefundStatus(value: unknown): RefundStatus {
  if (value === "processed") return "processed";
  if (value === "failed") return "failed";
  return "pending";
}

function amountInPaise(amount: number) {
  return Math.round(amount * 100);
}

function publicProviderError(error: unknown) {
  if (!error || typeof error !== "object") return "Razorpay could not initiate the refund";
  const candidate = error as {
    error?: { description?: unknown };
    description?: unknown;
  };
  const description = candidate.error?.description ?? candidate.description;
  return typeof description === "string" && description.trim()
    ? description.trim().slice(0, 500)
    : "Razorpay could not initiate the refund";
}

async function updateRefundedOrder(
  order: RefundOrderRecord,
  result: RefundResult,
  errorMessage?: string
) {
  const fullyRefunded = result.status === "processed" && result.amount >= Number(order.total);
  const fields = {
    refundStatus: result.status,
    refundAmount: result.amount,
    ...(result.providerRefundId ? { razorpayRefundId: result.providerRefundId } : {}),
    ...(errorMessage ? { refundError: errorMessage } : { refundError: undefined }),
    ...(fullyRefunded ? { paymentStatus: "refunded" as const } : {})
  };

  if (Order.db.readyState === 1) {
    const update: Record<string, unknown> = {
      $set: Object.fromEntries(
        Object.entries(fields).filter(([, value]) => value !== undefined)
      )
    };
    if (!errorMessage) update.$unset = { refundError: 1 };
    const updated = await Order.findOneAndUpdate(
      { orderNumber: order.orderNumber },
      update,
      { new: true, runValidators: true }
    ).lean() as unknown as (RefundOrderRecord & { _id: unknown }) | null;
    if (updated?._id) {
      await Payment.findOneAndUpdate(
        { order: updated._id, provider: "razorpay" },
        {
          $set: {
            providerRefundId: result.providerRefundId || undefined,
            refundAmount: amountInPaise(result.amount),
            refundStatus: result.status
          }
        }
      );
    }
    return updated;
  }

  return updateLocalOrder(order.orderNumber, fields);
}

export async function initiateRazorpayRefund(input: {
  order: RefundOrderRecord;
  amount: number;
  idempotencyKey: string;
  reason: string;
  issueId?: string;
}): Promise<RefundResult> {
  const { order } = input;
  if (order.paymentMethod !== "razorpay" || order.paymentStatus !== "paid") {
    throw new RefundProcessingError("Only captured Razorpay payments can be refunded", 409);
  }
  if (!order.razorpayPaymentId) {
    throw new RefundProcessingError("The captured payment ID is missing", 409);
  }

  const amount = Number(input.amount);
  const paise = amountInPaise(amount);
  if (!Number.isFinite(amount) || paise < 1 || amount > Number(order.total)) {
    throw new RefundProcessingError("Refund amount is invalid", 400);
  }

  const razorpay = getRazorpayClient();
  if (!razorpay) {
    throw new RefundProcessingError("Online refunds are not configured", 503);
  }

  if (Order.db.readyState === 1) {
    const existing = await Refund.findOne({
      idempotencyKey: input.idempotencyKey
    }).lean() as unknown as StoredRefundRecord | null;
    if (existing) {
      const result: RefundResult = {
        providerRefundId: existing.providerRefundId ?? "",
        amount: Number(existing.amount) / 100,
        status: normalizeRefundStatus(existing.status)
      };
      if (result.status === "failed") {
        throw new RefundProcessingError(existing.errorMessage || "The previous refund attempt failed", 502);
      }
      return result;
    }

    try {
      await Refund.create({
        order: order._id,
        ...(input.issueId ? { issue: input.issueId } : {}),
        providerPaymentId: order.razorpayPaymentId,
        idempotencyKey: input.idempotencyKey,
        amount: paise,
        status: "pending",
        reason: input.reason
      });
    } catch (error) {
      const duplicate = await Refund.findOne({
        idempotencyKey: input.idempotencyKey
      }).lean() as unknown as StoredRefundRecord | null;
      if (!duplicate) throw error;
      return {
        providerRefundId: duplicate.providerRefundId ?? "",
        amount: Number(duplicate.amount) / 100,
        status: normalizeRefundStatus(duplicate.status)
      };
    }
  } else if (order.refundStatus === "pending" || order.refundStatus === "processed") {
    return {
      providerRefundId: order.razorpayRefundId ?? "",
      amount: Number(order.refundAmount) || amount,
      status: normalizeRefundStatus(order.refundStatus)
    };
  }

  try {
    const providerRefund = await razorpay.payments.refund(order.razorpayPaymentId, {
      amount: paise,
      speed: "normal",
      receipt: input.idempotencyKey.slice(0, 40),
      notes: {
        orderNumber: order.orderNumber,
        reason: input.reason.slice(0, 200)
      }
    });
    const result: RefundResult = {
      providerRefundId: providerRefund.id,
      amount,
      status: normalizeRefundStatus(providerRefund.status)
    };

    if (Order.db.readyState === 1) {
      await Refund.findOneAndUpdate(
        { idempotencyKey: input.idempotencyKey },
        {
          $set: {
            providerRefundId: providerRefund.id,
            status: result.status,
            rawPayload: providerRefund
          },
          $unset: { errorMessage: 1 }
        }
      );
    }
    await updateRefundedOrder(order, result);
    if (result.status === "failed") {
      throw new RefundProcessingError("Razorpay rejected the refund", 502);
    }
    return result;
  } catch (error) {
    if (error instanceof RefundProcessingError) throw error;
    const message = publicProviderError(error);
    const failedResult: RefundResult = {
      providerRefundId: "",
      amount,
      status: "failed"
    };
    if (Order.db.readyState === 1) {
      await Refund.findOneAndUpdate(
        { idempotencyKey: input.idempotencyKey },
        { $set: { status: "failed", errorMessage: message, rawPayload: { message } } }
      );
    }
    await updateRefundedOrder(order, failedResult, message);
    throw new RefundProcessingError(message, 502);
  }
}

export async function reconcileRazorpayRefund(input: {
  providerRefundId: string;
  providerPaymentId: string;
  amountPaise: number;
  status: RefundStatus;
  eventId?: string;
  rawPayload: unknown;
}) {
  const order = Order.db.readyState === 1
    ? await Order.findOne({ razorpayPaymentId: input.providerPaymentId }).lean() as RefundOrderRecord | null
    : await getLocalOrderByPaymentId(input.providerPaymentId);
  if (!order) return null;

  if (Order.db.readyState === 1) {
    if (input.eventId) {
      const duplicate = await Refund.exists({
        providerRefundId: input.providerRefundId,
        webhookEventIds: input.eventId
      });
      if (duplicate) return { order, issue: null };
    }

    await Refund.findOneAndUpdate(
      {
        $or: [
          { providerRefundId: input.providerRefundId },
          {
            providerPaymentId: input.providerPaymentId,
            amount: input.amountPaise,
            status: "pending"
          }
        ]
      },
      {
        $set: {
          providerRefundId: input.providerRefundId,
          status: input.status,
          rawPayload: input.rawPayload
        },
        ...(input.eventId ? { $addToSet: { webhookEventIds: input.eventId } } : {})
      },
      { new: true }
    );
  }

  const result: RefundResult = {
    providerRefundId: input.providerRefundId,
    amount: input.amountPaise / 100,
    status: input.status
  };
  const updatedOrder = await updateRefundedOrder(
    order,
    result,
    input.status === "failed" ? "Razorpay could not process the refund" : undefined
  );

  let issue = null;
  if (Issue.db.readyState === 1) {
    issue = await Issue.findOneAndUpdate(
      {
        $or: [
          { razorpayRefundId: input.providerRefundId },
          {
            orderNumber: order.orderNumber,
            refundAmount: result.amount,
            refundStatus: "pending"
          }
        ]
      },
      {
        $set: {
          razorpayRefundId: input.providerRefundId,
          refundStatus: input.status,
          status: input.status === "processed" ? "refunded" : "investigating",
          chatStatus: input.status === "processed" ? "closed" : "active",
          ...(input.status === "processed" ? { closedAt: new Date() } : {})
        },
        ...(input.status === "processed" ? {} : { $unset: { closedAt: 1 } })
      },
      { new: true }
    );
  }

  return { order: updatedOrder, issue };
}

async function getLocalOrderByPaymentId(providerPaymentId: string) {
  return (await listLocalOrders()).find(
    (order) => order.razorpayPaymentId === providerPaymentId
  ) ?? null;
}
