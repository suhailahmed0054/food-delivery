import { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { Order } from "../models/Order";
import { DeliveryPerson } from "../models/DeliveryPerson";
import {
  assignLocalOrderDelivery,
  createLocalOrder,
  getLocalOrder,
  listLocalOrders,
  updateLocalOrderStatus,
  updateLocalOrder
} from "../services/localOrderStore";
import {
  getLocalDeliveryPerson,
  setLocalDeliveryPersonStatus
} from "../services/localDeliveryPersonStore";
import { sendOrderEmail, sendSms } from "../services/notificationService";
import { resolveRestaurantTableToken } from "../services/tableService";
import {
  deliveryRadiusKm,
  evaluateDeliveryZone,
  outsideDeliveryMessage
} from "../services/deliveryZoneService";
import {
  claimLegacyOrderTracking,
  createOrderTrackingToken,
  findOrderForTracking,
  getEstimatedDeliveryAt,
  hashOrderTrackingToken,
  orderTrackingRoom,
  toPublicOrderTracking,
  trackingClaimSchema,
  trackingCredentialsSchema,
  withoutOrderTrackingSecret
} from "../services/orderTrackingService";
import {
  getCommerceSettings,
  orderQuoteSchema,
  OrderPricingError,
  pricingOrderItemSchema,
  quoteOrderPricing
} from "../services/orderPricingService";
import { createInAppNotification } from "../services/inAppNotificationService";
import {
  initiateRazorpayRefund,
  RefundProcessingError,
  type RefundResult
} from "../services/refundService";

function sendRefundFailure(res: Response, error: unknown) {
  if (error instanceof RefundProcessingError) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  console.error("Unable to initiate Razorpay refund", error);
  return res.status(502).json({ message: "Razorpay could not initiate the refund" });
}

async function initiateCancellationRefund(
  order: Parameters<typeof initiateRazorpayRefund>[0]["order"],
  idempotencyKey: string,
  reason: string
): Promise<RefundResult | null> {
  if (order.paymentMethod !== "razorpay" || order.paymentStatus !== "paid") {
    return null;
  }

  return initiateRazorpayRefund({
    order,
    amount: Number(order.total),
    idempotencyKey,
    reason
  });
}

const createOrderSchema = z.object({
  items: z.array(pricingOrderItemSchema).min(1).max(100),
  total: z.coerce.number().finite().positive().optional(),
  tax: z.coerce.number().finite().min(0).optional(),
  deliveryFee: z.coerce.number().finite().min(0).optional(),
  discount: z.coerce.number().finite().min(0).optional(),
  couponCode: z.string().trim().max(30).optional(),
  paymentMethod: z.enum(["cash_on_delivery", "razorpay"]).optional(),
  paymentStatus: z.enum(["pending", "paid", "failed"]).optional(),
  razorpayOrderId: z.string().trim().max(200).optional(),
  orderType: z.enum(["delivery", "dine_in"]).default("delivery"),
  tableToken: z.string().trim().regex(/^[A-Za-z0-9_-]{16,128}$/).optional(),
  customerName: z.string().trim().min(1).max(200).optional(),
  phone: z.string().trim().max(30).optional(),
  email: z.string().trim().email().max(320).optional(),
  address: z.string().trim().max(1000).optional(),
  deliveryLatitude: z.number().finite().min(-90).max(90).optional(),
  deliveryLongitude: z.number().finite().min(-180).max(180).optional(),
  deliveryTime: z.string().trim().max(100).optional(),
  specialInstructions: z.string().trim().max(1000).optional()
}).superRefine((order, context) => {
  if (order.orderType === "delivery" && !order.address) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["address"],
      message: "Delivery address is required"
    });
  }
  if (order.orderType === "dine_in" && !order.tableToken) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["tableToken"],
      message: "A valid table QR token is required"
    });
  }
});

const orderStatusSchema = z.object({
  status: z.enum([
    "pending",
    "placed",
    "accepted",
    "preparing",
    "ready",
    "ready_for_pickup",
    "out_for_delivery",
    "served",
    "delivered",
    "cancelled"
  ]),
  email: z.string().trim().email().optional()
});

const assignDeliverySchema = z.object({
  deliveryPersonId: z.string().trim().min(1).max(200)
});

const deliveryStatusTransitions: Record<string, readonly string[]> = {
  pending: ["placed", "preparing", "cancelled"],
  placed: ["accepted", "preparing", "cancelled"],
  accepted: ["preparing", "cancelled"],
  preparing: ["ready", "ready_for_pickup", "cancelled"],
  ready: ["out_for_delivery", "cancelled"],
  ready_for_pickup: ["out_for_delivery", "cancelled"],
  out_for_delivery: ["delivered"],
  delivered: [],
  cancelled: []
};

const dineInStatusTransitions: Record<string, readonly string[]> = {
  pending: ["accepted", "preparing", "cancelled"],
  placed: ["accepted", "preparing", "cancelled"],
  accepted: ["preparing", "cancelled"],
  preparing: ["ready", "ready_for_pickup", "cancelled"],
  ready: ["served"],
  ready_for_pickup: ["served"],
  served: [],
  cancelled: []
};

const kitchenStatusTransitions: Record<string, readonly string[]> = {
  pending: ["preparing"],
  placed: ["preparing"],
  accepted: ["preparing"],
  preparing: ["ready", "ready_for_pickup"],
  ready: [],
  ready_for_pickup: [],
  out_for_delivery: [],
  delivered: [],
  served: [],
  cancelled: []
};

function allowedNextStatuses(
  currentStatus: string,
  orderType: "delivery" | "dine_in",
  role: "admin" | "kitchen"
) {
  if (role === "kitchen") return kitchenStatusTransitions[currentStatus] ?? [];
  const transitions = orderType === "dine_in"
    ? dineInStatusTransitions
    : deliveryStatusTransitions;
  return transitions[currentStatus] ?? [];
}

function isMongoConnected() {
  return Order.db.readyState === 1;
}

function createOrderNumber() {
  return `AR-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 90 + 10)}`;
}

function normalizePhone(value?: string) {
  return value?.replace(/\D/g, "") || undefined;
}

function orderCustomerId(order: unknown) {
  const customer = (order as { customer?: unknown })?.customer;
  if (!customer) return undefined;
  if (typeof customer === "object" && "_id" in customer) {
    return String((customer as { _id: unknown })._id);
  }
  return String(customer);
}

function orderStatusMessage(status: string, orderType: "delivery" | "dine_in") {
  const messages: Record<string, string> = {
    pending: "Your order has been received by the restaurant.",
    placed: "Your order has been placed successfully.",
    accepted: "The restaurant accepted your order.",
    preparing: "The kitchen is preparing your food.",
    ready: orderType === "dine_in"
      ? "Your food is ready to be served."
      : "Your order is ready for pickup.",
    ready_for_pickup: "Your order is ready for pickup.",
    out_for_delivery: "Your order is on the way.",
    served: "Your food has been served. Enjoy your meal.",
    delivered: "Your order has been delivered. Enjoy your meal.",
    cancelled: "Your order has been cancelled."
  };
  return messages[status] ?? `Your order status changed to ${status.replace(/_/g, " ")}.`;
}

function sendPricingError(res: Response, error: unknown) {
  if (error instanceof OrderPricingError) {
    return res.status(error.status).json({
      message: error.message,
      code: error.code
    });
  }

  throw error;
}

export async function quoteOrder(req: Request, res: Response) {
  const parsed = orderQuoteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid order quote",
      errors: parsed.error.flatten()
    });
  }

  try {
    return res.json(await quoteOrderPricing(parsed.data));
  } catch (error) {
    return sendPricingError(res, error);
  }
}

export async function createOrder(req: Request, res: Response) {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid order details", errors: parsed.error.flatten() });
  }

  const settings = await getCommerceSettings();
  if (!settings.restaurantOpen) {
    return res.status(503).json({
      message: "Restaurant is not live and is not accepting orders right now."
    });
  }
  const paymentMethod = parsed.data.paymentMethod ?? "cash_on_delivery";
  if (
    (paymentMethod === "cash_on_delivery" && !settings.cashEnabled) ||
    (paymentMethod === "razorpay" && !settings.onlinePaymentEnabled)
  ) {
    return res.status(409).json({
      message:
        paymentMethod === "cash_on_delivery"
          ? "Cash payments are currently unavailable."
          : "Online payments are currently unavailable."
    });
  }

  const {
    tableToken,
    deliveryLatitude,
    deliveryLongitude,
    ...orderInput
  } = parsed.data;

  let deliveryDistanceKm: number | undefined;
  if (orderInput.orderType === "delivery") {
    if (
      deliveryLatitude === undefined ||
      deliveryLongitude === undefined
    ) {
      return res.status(400).json({
        message:
          "Please use your current location so we can check delivery availability."
      });
    }

    const deliveryZone = evaluateDeliveryZone({
      lat: deliveryLatitude,
      lng: deliveryLongitude
    });
    deliveryDistanceKm = deliveryZone.distanceKm;
    if (!deliveryZone.isWithinDeliveryZone) {
      return res.status(422).json({
        message: outsideDeliveryMessage,
        distanceKm: Number(deliveryDistanceKm.toFixed(2)),
        deliveryRadiusKm
      });
    }
  }

  const table = orderInput.orderType === "dine_in"
    ? await resolveRestaurantTableToken(tableToken!)
    : null;

  if (orderInput.orderType === "dine_in" && !table) {
    return res.status(400).json({ message: "This table QR code is invalid or inactive" });
  }

  let quote;
  try {
    quote = await quoteOrderPricing({
      items: orderInput.items,
      orderType: orderInput.orderType,
      couponCode: orderInput.couponCode,
      phone: orderInput.phone
    });
  } catch (error) {
    return sendPricingError(res, error);
  }
  if (!quote.canOrder) {
    return res.status(422).json({
      message: `Minimum delivery order is Rs ${quote.minimumOrder}. Add Rs ${quote.amountToMinimum} more.`,
      code: "MINIMUM_ORDER_NOT_MET",
      quote
    });
  }
  if (quote.coupon && !quote.coupon.applied) {
    return res.status(422).json({
      message: quote.coupon.message,
      code: "COUPON_NOT_APPLIED",
      quote
    });
  }

  const status = paymentMethod === "razorpay"
    ? "pending"
    : orderInput.orderType === "dine_in"
      ? "pending"
      : "placed";
  const createdAt = new Date();
  const trackingToken = createOrderTrackingToken();
  const orderData = {
    orderNumber: createOrderNumber(),
    status,
    customerName: orderInput.customerName,
    items: quote.items.map((item) => ({
      menuItem: item.menuItem,
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      customization: item.customization
    })),
    subtotal: quote.subtotal,
    total: quote.total,
    tax: quote.tax,
    deliveryFee: quote.deliveryFee,
    discount: quote.discount,
    couponCode: quote.coupon?.applied ? quote.coupon.code : undefined,
    paymentMethod,
    paymentStatus: "pending" as const,
    razorpayOrderId: orderInput.razorpayOrderId,
    orderType: orderInput.orderType,
    customer: req.user?.id,
    phone: orderInput.phone,
    customerPhoneNormalized: normalizePhone(orderInput.phone),
    email: orderInput.email,
    deliveryTime: orderInput.deliveryTime,
    specialInstructions: orderInput.specialInstructions,
    table: table?.id,
    tableNumber: table ? String(table.tableNumber) : undefined,
    trackingTokenHash: hashOrderTrackingToken(trackingToken),
    estimatedDeliveryAt: getEstimatedDeliveryAt(
      status,
      orderInput.orderType,
      createdAt
    ),
    statusHistory: [{ status, at: createdAt.toISOString() }],
    address:
      orderInput.orderType === "delivery" ? orderInput.address : undefined,
    deliveryLatitude:
      orderInput.orderType === "delivery" ? deliveryLatitude : undefined,
    deliveryLongitude:
      orderInput.orderType === "delivery" ? deliveryLongitude : undefined,
    deliveryDistanceKm:
      orderInput.orderType === "delivery"
        ? Number(deliveryDistanceKm?.toFixed(3))
        : undefined
  };
  const order = isMongoConnected()
    ? await Order.create(orderData)
    : await createLocalOrder(orderData);

  const io = req.app.get("io");
  await createInAppNotification(
    {
      audience: "admin",
      type: "order",
      title: "New order received",
      message: `${orderData.orderNumber} · ${quote.items.length} dish${quote.items.length === 1 ? "" : "es"} · Rs ${quote.total}`,
      href: "/admin?tab=Live%20Orders",
      orderNumber: orderData.orderNumber,
      dedupeKey: `admin:order-created:${orderData.orderNumber}`
    },
    io
  );
  if (orderData.customer) {
    await createInAppNotification(
      {
        audience: "customer",
        recipient: orderData.customer,
        type: "order",
        title: "Order received",
        message: `${orderData.orderNumber} has been sent to the restaurant.`,
        href: "/orders",
        orderNumber: orderData.orderNumber,
        dedupeKey: `customer:${orderData.customer}:order-created:${orderData.orderNumber}`
      },
      io
    );
  }

  try {
    await sendSms(parsed.data.phone ?? "demo", `Al-Arab order ${orderData.orderNumber} placed.`);
  } catch (error) {
    console.warn("Order created, but the SMS notification failed.", error);
  }
  return res.status(201).json({
    ...withoutOrderTrackingSecret(order),
    trackingToken
  });
}

export async function listOrders(req: Request, res: Response) {
  if (!isMongoConnected()) {
    const orders = await listLocalOrders();
    return res.json(
      orders.slice(0, 100).map((order) => withoutOrderTrackingSecret(order))
    );
  }

  const filter = req.user?.role === "customer" ? { customer: req.user.id } : {};
  const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(100);
  return res.json(orders);
}

export async function getOrderTracking(req: Request, res: Response) {
  const orderNumber = Array.isArray(req.params.id)
    ? req.params.id[0]
    : req.params.id;
  const parsed = trackingCredentialsSchema.safeParse({
    orderNumber,
    trackingToken: req.body?.trackingToken
  });
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid tracking details" });
  }

  const order = await findOrderForTracking(
    parsed.data.orderNumber,
    parsed.data.trackingToken
  );
  if (!order) {
    return res.status(404).json({ message: "Order tracking was not found" });
  }

  return res.json(toPublicOrderTracking(order));
}

export async function claimOrderTracking(req: Request, res: Response) {
  const orderNumber = Array.isArray(req.params.id)
    ? req.params.id[0]
    : req.params.id;
  const parsed = trackingClaimSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Enter the order phone number" });
  }

  const claimed = await claimLegacyOrderTracking(
    orderNumber,
    parsed.data.phone
  );
  if (!claimed) {
    return res.status(404).json({ message: "Order tracking was not found" });
  }

  return res.json(claimed);
}

export async function updateOrderStatus(req: Request, res: Response) {
  const orderId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = orderStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid order status", errors: parsed.error.flatten() });
  }

  const existingOrder = isMongoConnected()
    ? mongoose.Types.ObjectId.isValid(orderId)
      ? await Order.findById(orderId)
      : await Order.findOne({ orderNumber: orderId })
    : await getLocalOrder(orderId);
  if (!existingOrder) {
    return res.status(404).json({ message: "Order not found" });
  }

  const isUnpaidOnlineOrder =
    existingOrder.paymentMethod === "razorpay" &&
    existingOrder.paymentStatus !== "paid";
  if (isUnpaidOnlineOrder && parsed.data.status !== "cancelled") {
    return res.status(409).json({
      message: "Online payment must be verified before this order can be processed"
    });
  }

  const orderType =
    existingOrder.orderType === "dine_in" ? "dine_in" : "delivery";
  const currentStatus = String(existingOrder.status).toLowerCase();
  const requestedStatus = parsed.data.status;
  if (currentStatus === requestedStatus) return res.json(existingOrder);
  const role = req.user?.role === "kitchen" ? "kitchen" : "admin";
  const allowedStatuses = allowedNextStatuses(currentStatus, orderType, role);
  if (!allowedStatuses.includes(requestedStatus)) {
    return res.status(409).json({
      message: `${role === "kitchen" ? "Kitchen staff" : "Administrators"} cannot move a ${orderType.replace("_", "-")} order from ${currentStatus.replace(/_/g, " ")} to ${requestedStatus.replace(/_/g, " ")}`,
      currentStatus,
      allowedStatuses
    });
  }
  const now = new Date();
  const estimatedDeliveryAt = getEstimatedDeliveryAt(
    parsed.data.status,
    orderType,
    now
  );
  const isCompleted = ["delivered", "served", "cancelled"].includes(
    parsed.data.status
  );
  let cancellationRefund: RefundResult | null = null;
  if (parsed.data.status === "cancelled") {
    try {
      cancellationRefund = await initiateCancellationRefund(
        existingOrder,
        `admin-cancel:${existingOrder.orderNumber}`,
        "Order cancelled by restaurant administration"
      );
    } catch (error) {
      return sendRefundFailure(res, error);
    }
  }

  let order;
  if (isMongoConnected()) {
    const cancellationFields = parsed.data.status === "cancelled" ? {
      cancelledAt: now,
      cancelledBy: "admin",
      cancelReason: "Cancelled by admin"
    } : {};

    const refundFields = cancellationRefund ? {
      refundStatus: cancellationRefund.status,
      refundAmount: cancellationRefund.amount,
      ...(cancellationRefund.providerRefundId
        ? { razorpayRefundId: cancellationRefund.providerRefundId }
        : {}),
      ...(cancellationRefund.status === "processed"
        ? { paymentStatus: "refunded" }
        : {})
    } : {};

    order = await Order.findOneAndUpdate(
      { _id: existingOrder._id, status: currentStatus },
      {
        $set: {
          status: parsed.data.status,
          ...(isCompleted ? { completedAt: now } : {}),
          ...(estimatedDeliveryAt ? { estimatedDeliveryAt: new Date(estimatedDeliveryAt) } : {}),
          ...cancellationFields,
          ...refundFields
        },
        $unset: {
          ...(!isCompleted ? { completedAt: 1 } : {}),
          ...(!estimatedDeliveryAt ? { estimatedDeliveryAt: 1 } : {})
        },
        $push: {
          statusHistory: { status: parsed.data.status, at: now }
        }
      },
      { new: true, runValidators: true }
    );
  } else {
    const cancellationFields = parsed.data.status === "cancelled" ? {
      cancelledAt: now.toISOString(),
      cancelledBy: "admin" as const,
      cancelReason: "Cancelled by admin"
    } : {};

    const refundFields = cancellationRefund ? {
      refundStatus: cancellationRefund.status,
      refundAmount: cancellationRefund.amount,
      ...(cancellationRefund.providerRefundId
        ? { razorpayRefundId: cancellationRefund.providerRefundId }
        : {}),
      ...(cancellationRefund.status === "processed"
        ? { paymentStatus: "refunded" as const }
        : {})
    } : {};

    order = await updateLocalOrder(existingOrder.id, {
      status: parsed.data.status,
      estimatedDeliveryAt,
      completedAt: isCompleted ? now.toISOString() : undefined,
      statusHistory: [
        ...(existingOrder.statusHistory ?? []),
        { status: parsed.data.status, at: now.toISOString() }
      ],
      ...cancellationFields,
      ...refundFields
    });
  }

  if (!order) {
    return res.status(409).json({
      message: "Order status changed before this update completed. Refresh and try again."
    });
  }

  const assignedStaffId = (
    order as unknown as { deliveryAgent?: { staffId?: string } }
  ).deliveryAgent?.staffId;
  if (
    assignedStaffId &&
    (parsed.data.status === "delivered" || parsed.data.status === "cancelled")
  ) {
    if (isMongoConnected()) {
      await DeliveryPerson.findByIdAndUpdate(assignedStaffId, { status: "available" });
    } else {
      await setLocalDeliveryPersonStatus(assignedStaffId, "available");
    }
  }

  const trackingUpdate = toPublicOrderTracking(order);
  const io = req.app.get("io");
  if (io) {
    const room = orderTrackingRoom(trackingUpdate.orderNumber);
    io.to(room).emit("order:status", trackingUpdate);
    io.to("orders:staff").emit("order_updated", trackingUpdate);
    if (parsed.data.status === "cancelled") {
      io.to(room).emit("order_cancelled", trackingUpdate);
      io.to("orders:staff").emit("order_cancelled", trackingUpdate);
    }
  }

  const customerId = orderCustomerId(order);
  if (customerId) {
    await createInAppNotification(
      {
        audience: "customer",
        recipient: customerId,
        type: "order",
        title: `Order ${trackingUpdate.status.replace(/_/g, " ")}`,
        message: orderStatusMessage(trackingUpdate.status, trackingUpdate.orderType),
        href: "/orders",
        orderNumber: trackingUpdate.orderNumber,
        dedupeKey: `customer:${customerId}:order-status:${trackingUpdate.orderNumber}:${trackingUpdate.status}`
      },
      io
    );
  }

  try {
    await sendOrderEmail(parsed.data.email ?? "customer@example.com", "Al-Arab order update", `<p>Status: ${order.status}</p>`);
  } catch (error) {
    console.warn("Order status changed, but the email notification failed.", error);
  }
  return res.json(order);
}

export async function cancelOrder(req: Request, res: Response) {
  const orderId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { reason, trackingToken } = req.body;

  const existingOrder = isMongoConnected()
    ? mongoose.Types.ObjectId.isValid(orderId)
      ? await Order.findById(orderId)
      : await Order.findOne({ orderNumber: orderId })
    : await getLocalOrder(orderId);

  if (!existingOrder) {
    return res.status(404).json({ message: "Order not found" });
  }

  const isAdminOrStaff = req.user && (req.user.role === "admin" || req.user.role === "kitchen");

  if (!isAdminOrStaff) {
    if (req.user && req.user.role === "customer") {
      const orderCustomerId = String(existingOrder.customer?._id || existingOrder.customer || "");
      if (orderCustomerId !== req.user.id) {
        return res.status(403).json({ message: "You are not authorized to cancel this order" });
      }
    } else {
      if (!trackingToken) {
        return res.status(401).json({ message: "Tracking token is required to cancel this order" });
      }
      const hashedInput = hashOrderTrackingToken(trackingToken);
      if (existingOrder.trackingTokenHash !== hashedInput) {
        return res.status(403).json({ message: "Invalid tracking token" });
      }
    }
  }

  const allowedStatuses = ["pending", "placed"];
  if (!allowedStatuses.includes(existingOrder.status)) {
    return res.status(400).json({
      message: `Cannot cancel order at this stage. Current status is ${existingOrder.status}.`
    });
  }

  const cancelledBy = isAdminOrStaff ? "admin" : "customer";
  const now = new Date();

  let cancellationRefund: RefundResult | null = null;
  try {
    cancellationRefund = await initiateCancellationRefund(
      existingOrder,
      `customer-cancel:${existingOrder.orderNumber}`,
      reason || "Order cancelled by customer"
    );
  } catch (error) {
    return sendRefundFailure(res, error);
  }

  let updatedOrder;
  if (isMongoConnected()) {
    const statusHistoryUpdate = { status: "cancelled", at: now };
    updatedOrder = await Order.findOneAndUpdate(
      { _id: existingOrder._id },
      {
        $set: {
          status: "cancelled",
          completedAt: now,
          cancelledAt: now,
          cancelledBy,
          cancelReason: reason || "Cancelled by user",
          ...(cancellationRefund
            ? {
                refundStatus: cancellationRefund.status,
                refundAmount: cancellationRefund.amount,
                ...(cancellationRefund.providerRefundId
                  ? { razorpayRefundId: cancellationRefund.providerRefundId }
                  : {}),
                ...(cancellationRefund.status === "processed"
                  ? { paymentStatus: "refunded" }
                  : {})
              }
            : {})
        },
        $push: {
          statusHistory: statusHistoryUpdate
        }
      },
      { new: true }
    );
  } else {
    const statusHistory = [
      ...(existingOrder.statusHistory ?? []),
      { status: "cancelled", at: now.toISOString() }
    ];
    updatedOrder = await updateLocalOrder(existingOrder.id, {
      status: "cancelled",
      completedAt: now.toISOString(),
      cancelledAt: now.toISOString(),
      cancelledBy,
      cancelReason: reason || "Cancelled by user",
      ...(cancellationRefund
        ? {
            refundStatus: cancellationRefund.status,
            refundAmount: cancellationRefund.amount,
            ...(cancellationRefund.providerRefundId
              ? { razorpayRefundId: cancellationRefund.providerRefundId }
              : {}),
            ...(cancellationRefund.status === "processed"
              ? { paymentStatus: "refunded" as const }
              : {})
          }
        : {}),
      statusHistory
    });
  }

  if (!updatedOrder) {
    return res.status(500).json({ message: "Failed to update order" });
  }

  const trackingUpdate = toPublicOrderTracking(updatedOrder);
  const io = req.app.get("io");
  if (io) {
    const room = orderTrackingRoom(trackingUpdate.orderNumber);
    io.to(room).emit("order:status", trackingUpdate);
    io.to(room).emit("order_cancelled", trackingUpdate);
    io.to("orders:staff").emit("order_cancelled", trackingUpdate);
    io.to("orders:staff").emit("order_updated", trackingUpdate);
  }

  await createInAppNotification(
    {
      audience: "admin",
      type: "order",
      title: "Order cancelled",
      message: `${trackingUpdate.orderNumber} was cancelled by ${cancelledBy}.`,
      href: "/admin?tab=Live%20Orders",
      orderNumber: trackingUpdate.orderNumber,
      dedupeKey: `admin:order-cancelled:${trackingUpdate.orderNumber}`
    },
    io
  );
  const cancelledCustomerId = orderCustomerId(updatedOrder);
  if (cancelledCustomerId) {
    await createInAppNotification(
      {
        audience: "customer",
        recipient: cancelledCustomerId,
        type: "order",
        title: "Order cancelled",
        message: `${trackingUpdate.orderNumber} has been cancelled.`,
        href: "/orders",
        orderNumber: trackingUpdate.orderNumber,
        dedupeKey: `customer:${cancelledCustomerId}:order-status:${trackingUpdate.orderNumber}:cancelled`
      },
      io
    );
  }

  try {
    await sendOrderEmail(updatedOrder.email ?? "customer@example.com", "Al-Arab Order Cancelled", `<p>Your order ${updatedOrder.orderNumber} has been cancelled.</p>`);
  } catch (error) {
    console.warn("Order cancelled email notification failed.", error);
  }

  return res.json(updatedOrder);
}

export async function assignOrderDelivery(req: Request, res: Response) {
  const orderId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = assignDeliverySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Select a delivery person" });
  }

  if (!isMongoConnected()) {
    const order = await getLocalOrder(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.orderType !== "delivery") {
      return res.status(400).json({ message: "Dine-in orders cannot be assigned for delivery" });
    }

    const person = await getLocalDeliveryPerson(parsed.data.deliveryPersonId);
    if (!person) return res.status(404).json({ message: "Delivery person not found" });
    if (
      person.status !== "available" &&
      order.deliveryAgent?.staffId !== person.id
    ) {
      return res.status(409).json({ message: `${person.name} is not available` });
    }

    const previousStaffId = order.deliveryAgent?.staffId;
    const updatedOrder = await assignLocalOrderDelivery(orderId, {
      staffId: person.id,
      name: person.name,
      phone: person.phone
    });
    await setLocalDeliveryPersonStatus(person.id, "busy");
    if (previousStaffId && previousStaffId !== person.id) {
      await setLocalDeliveryPersonStatus(previousStaffId, "available");
    }

    if (updatedOrder) {
      const trackingUpdate = toPublicOrderTracking(updatedOrder);
      const io = req.app.get("io");
      if (io) {
        io.to(orderTrackingRoom(trackingUpdate.orderNumber)).emit("order:assigned", trackingUpdate);
        io.to("orders:staff").emit("order_updated", trackingUpdate);
      }
      const customerId = orderCustomerId(updatedOrder);
      if (customerId) {
        await createInAppNotification(
          {
            audience: "customer",
            recipient: customerId,
            type: "delivery",
            title: "Delivery partner assigned",
            message: `${person.name} is assigned to order ${trackingUpdate.orderNumber}.`,
            href: "/orders",
            orderNumber: trackingUpdate.orderNumber,
            dedupeKey: `customer:${customerId}:delivery-assigned:${trackingUpdate.orderNumber}:${person.id}`
          },
          io
        );
      }
    }
    return res.json(updatedOrder);
  }

  const order = mongoose.Types.ObjectId.isValid(orderId)
    ? await Order.findById(orderId)
    : await Order.findOne({ orderNumber: orderId });
  if (!order) return res.status(404).json({ message: "Order not found" });
  if (order.orderType !== "delivery") {
    return res.status(400).json({ message: "Dine-in orders cannot be assigned for delivery" });
  }

  if (!mongoose.Types.ObjectId.isValid(parsed.data.deliveryPersonId)) {
    return res.status(404).json({ message: "Delivery person not found" });
  }
  const person = await DeliveryPerson.findById(parsed.data.deliveryPersonId);
  if (!person) return res.status(404).json({ message: "Delivery person not found" });

  const currentStaffId = order.deliveryAgent?.staffId;
  if (person.status !== "available" && currentStaffId !== String(person._id)) {
    return res.status(409).json({ message: `${person.name} is not available` });
  }

  order.deliveryAgent = {
    staffId: String(person._id),
    name: person.name,
    phone: person.phone
  };
  await order.save();
  person.status = "busy";
  await person.save();
  if (currentStaffId && currentStaffId !== String(person._id)) {
    await DeliveryPerson.findByIdAndUpdate(currentStaffId, { status: "available" });
  }

  const trackingUpdate = toPublicOrderTracking(order);
  const io = req.app.get("io");
  if (io) {
    io.to(orderTrackingRoom(trackingUpdate.orderNumber)).emit("order:assigned", trackingUpdate);
    io.to("orders:staff").emit("order_updated", trackingUpdate);
  }
  const customerId = orderCustomerId(order);
  if (customerId) {
    await createInAppNotification(
      {
        audience: "customer",
        recipient: customerId,
        type: "delivery",
        title: "Delivery partner assigned",
        message: `${person.name} is assigned to order ${trackingUpdate.orderNumber}.`,
        href: "/orders",
        orderNumber: trackingUpdate.orderNumber,
        dedupeKey: `customer:${customerId}:delivery-assigned:${trackingUpdate.orderNumber}:${person.id}`
      },
      io
    );
  }
  return res.json(order);
}
