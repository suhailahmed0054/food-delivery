import { Request, Response } from "express";
import { randomInt } from "node:crypto";
import mongoose from "mongoose";
import { z } from "zod";
import { Order } from "../models/Order";
import { DeliveryPerson } from "../models/DeliveryPerson";
import { Payment } from "../models/Payment";
import {
  assignLocalOrderDelivery,
  createLocalOrderIdempotently,
  findLocalOrderByIdempotency,
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
  findOrderForTracking,
  getEstimatedDeliveryAt,
  hashOrderTrackingToken,
  orderTrackingRoom,
  toPublicOrderTracking,
  trackingCredentialsSchema,
  withoutOrderTrackingSecret
} from "../services/orderTrackingService";
import {
  createIdempotentOrderTrackingToken,
  fingerprintOrderRequest,
  hashOrderIdempotencyKey,
  IdempotencyConflictError,
  orderIdempotencyKeySchema
} from "../services/orderIdempotencyService";
import {
  getCommerceSettings,
  orderQuoteSchema,
  OrderPricingError,
  pricingOrderItemSchema,
  quoteOrderPricing
} from "../services/orderPricingService";
import {
  getAllowedNextOrderStatuses,
  orderStatusValues
} from "../services/orderStatusWorkflow";
import { getOrderAuthenticationDecision } from "../services/orderAuthenticationService";
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
  paymentMethod: z.literal("cash_on_delivery").optional(),
  orderType: z.enum(["delivery", "takeaway", "dine_in"]).default("delivery"),
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
  status: z.enum(orderStatusValues),
  email: z.string().trim().email().optional()
});

const assignDeliverySchema = z.object({
  deliveryPersonId: z.string().trim().min(1).max(200)
});

const cancelOrderSchema = z.object({
  reason: z.string().trim().max(500).optional(),
  trackingToken: z.string().trim().min(32).max(128).optional()
});

const listOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(100).optional(),
  status: z.enum(orderStatusValues).optional(),
  orderType: z.enum(["delivery", "takeaway", "dine_in"]).optional(),
  paginated: z.enum(["true", "false"]).default("false")
});

function isMongoConnected() {
  return Order.db.readyState === 1;
}

function createOrderNumber() {
  const date = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  return `AR-${date}-${randomInt(100000, 1000000)}`;
}

function isOrderNumberDuplicate(error: unknown) {
  const duplicate = error as {
    code?: number;
    keyPattern?: Record<string, number>;
    keyValue?: Record<string, unknown>;
  };
  return duplicate?.code === 11000 &&
    (Boolean(duplicate.keyPattern?.orderNumber) ||
      Boolean(duplicate.keyValue?.orderNumber));
}

function escapeRegularExpression(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

function orderStatusMessage(
  status: string,
  orderType: "delivery" | "takeaway" | "dine_in"
) {
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
    collected: "Your takeaway order has been collected.",
    delivered: "Your order has been delivered. Enjoy your meal.",
    completed: "Your order is complete. Thank you for ordering.",
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

  const parsedIdempotencyKey = orderIdempotencyKeySchema.safeParse(
    req.header("Idempotency-Key")
  );
  if (!parsedIdempotencyKey.success) {
    return res.status(400).json({
      message:
        "A valid Idempotency-Key header is required for order creation"
    });
  }

  const authentication = getOrderAuthenticationDecision(
    parsed.data.orderType,
    req.user
  );
  if (!authentication.allowed) {
    return res.status(authentication.status).json({
      message: authentication.message,
      code: authentication.code,
      orderType: parsed.data.orderType
    });
  }
  if (authentication.isGuestOrder && !parsed.data.customerName?.trim()) {
    return res.status(400).json({
      message: "Enter your name to continue as a dine-in guest",
      code: "GUEST_NAME_REQUIRED"
    });
  }

  const customerId = authentication.customerId;
  const idempotencySubject = authentication.idempotencySubject;
  const idempotencyKey = parsedIdempotencyKey.data;
  const idempotencyKeyHash = hashOrderIdempotencyKey(
    idempotencySubject,
    idempotencyKey
  );
  const idempotencyRequestHash = fingerprintOrderRequest(
    idempotencySubject,
    parsed.data
  );
  const trackingToken = createIdempotentOrderTrackingToken(
    idempotencySubject,
    idempotencyKey
  );

  const existingOrder = isMongoConnected()
    ? await Order.findOne({
        idempotencyKeyHash
      }).select("+idempotencyKeyHash +idempotencyRequestHash")
    : await findLocalOrderByIdempotency(idempotencyKeyHash);

  if (existingOrder) {
    if (
      String(
        (existingOrder as unknown as { idempotencyRequestHash?: string })
          .idempotencyRequestHash ?? ""
      ) !== idempotencyRequestHash
    ) {
      return res.status(409).json({
        message:
          "This checkout key was already used with different order details"
      });
    }

    res.setHeader("Idempotency-Replayed", "true");
    return res.status(200).json({
      ...withoutOrderTrackingSecret(existingOrder),
      trackingToken
    });
  }

  const settings = await getCommerceSettings();
  if (!settings.restaurantOpen) {
    return res.status(503).json({
      message: "Restaurant is not live and is not accepting orders right now."
    });
  }
  const paymentMethod = parsed.data.paymentMethod ?? "cash_on_delivery";
  if (!settings.cashEnabled) {
    return res.status(409).json({
      message: "Cash payments are currently unavailable."
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

  const status = orderInput.orderType === "dine_in" ? "pending" : "placed";
  const createdAt = new Date();
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
    orderType: orderInput.orderType,
    ...(customerId ? { customer: customerId } : {}),
    isGuestOrder: authentication.isGuestOrder,
    phone: orderInput.phone,
    customerPhoneNormalized: normalizePhone(orderInput.phone),
    email: orderInput.email,
    deliveryTime: orderInput.deliveryTime,
    specialInstructions: orderInput.specialInstructions,
    table: table?.id,
    tableNumber: table ? String(table.tableNumber) : undefined,
    trackingTokenHash: hashOrderTrackingToken(trackingToken),
    idempotencyKeyHash,
    idempotencyRequestHash,
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
  let order;
  let replayed = false;
  try {
    if (isMongoConnected()) {
      let lastCollision: unknown;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
          order = await Order.create({
            ...orderData,
            orderNumber: attempt === 0
              ? orderData.orderNumber
              : createOrderNumber()
          });
          break;
        } catch (error) {
          if (!isOrderNumberDuplicate(error)) throw error;
          lastCollision = error;
        }
      }
      if (!order) throw lastCollision ?? new Error("Unable to allocate an order number");
    } else {
      const localResult = await createLocalOrderIdempotently(orderData);
      order = localResult.order;
      replayed = localResult.replayed;
    }
  } catch (error) {
    if (error instanceof IdempotencyConflictError) {
      return res.status(409).json({ message: error.message });
    }

    const duplicateKeyError = error as {
      code?: number;
      keyPattern?: Record<string, number>;
    };
    if (duplicateKeyError?.code === 11000) {
      const concurrentOrder = await Order.findOne({
        idempotencyKeyHash
      }).select("+idempotencyKeyHash +idempotencyRequestHash");

      if (concurrentOrder) {
        const concurrentRequestHash = String(
          (concurrentOrder as unknown as {
            idempotencyRequestHash?: string;
          }).idempotencyRequestHash ?? ""
        );
        if (concurrentRequestHash !== idempotencyRequestHash) {
          return res.status(409).json({
            message:
              "This checkout key was already used with different order details"
          });
        }
        order = concurrentOrder;
        replayed = true;
      } else {
        throw error;
      }
    } else {
      throw error;
    }
  }

  if (replayed) {
    res.setHeader("Idempotency-Replayed", "true");
    return res.status(200).json({
      ...withoutOrderTrackingSecret(order),
      trackingToken
    });
  }

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
  const parsed = listOrdersQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid order filters",
      errors: parsed.error.flatten()
    });
  }

  const { page, limit, search, status, orderType, paginated } = parsed.data;
  const shouldPaginate = paginated === "true";

  if (!isMongoConnected()) {
    const normalizedSearch = search?.toLowerCase();
    const filtered = (await listLocalOrders()).filter((order) => {
      if (status && order.status !== status) return false;
      if (orderType && order.orderType !== orderType) return false;
      if (!normalizedSearch) return true;
      return [order.orderNumber, order.customerName, order.phone, order.email]
        .some((value) => String(value ?? "").toLowerCase().includes(normalizedSearch));
    });
    if (!shouldPaginate) {
      return res.json(filtered.slice(0, 100).map(withoutOrderTrackingSecret));
    }
    const offset = (page - 1) * limit;
    return res.json({
      orders: filtered.slice(offset, offset + limit).map(withoutOrderTrackingSecret),
      page,
      limit,
      total: filtered.length,
      totalPages: Math.max(1, Math.ceil(filtered.length / limit))
    });
  }

  const filter: Record<string, unknown> =
    req.user?.role === "customer" ? { customer: req.user.id } : {};
  if (status) filter.status = status;
  if (orderType) filter.orderType = orderType;
  if (search) {
    const expression = new RegExp(escapeRegularExpression(search), "i");
    filter.$or = [
      { orderNumber: expression },
      { customerName: expression },
      { phone: expression },
      { email: expression }
    ];
  }

  if (!shouldPaginate) {
    const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(100);
    return res.json(orders);
  }

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Order.countDocuments(filter)
  ]);
  return res.json({
    orders,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit))
  });
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

  const orderType = existingOrder.orderType === "dine_in"
    ? "dine_in"
    : existingOrder.orderType === "takeaway"
      ? "takeaway"
      : "delivery";
  const currentStatus = String(existingOrder.status).toLowerCase();
  const requestedStatus = parsed.data.status;
  if (currentStatus === requestedStatus) return res.json(existingOrder);
  const role = req.user?.role === "kitchen" ? "kitchen" : "admin";
  const allowedStatuses = getAllowedNextOrderStatuses(
    currentStatus,
    orderType,
    role
  );
  if (!allowedStatuses.includes(requestedStatus)) {
    console.warn("Rejected invalid order status transition", {
      requestId: res.locals.requestId,
      orderId,
      orderType,
      role,
      currentStatus,
      requestedStatus,
      allowedStatuses
    });
    return res.status(409).json({
      message: `${role === "kitchen" ? "Kitchen staff" : "Administrators"} cannot move a ${orderType.replace("_", "-")} order from ${currentStatus.replace(/_/g, " ")} to ${requestedStatus.replace(/_/g, " ")}`,
      currentStatus,
      allowedStatuses
    });
  }
  if (
    orderType === "delivery" &&
    requestedStatus === "out_for_delivery" &&
    !(existingOrder as unknown as { deliveryAgent?: { staffId?: string } })
      .deliveryAgent?.staffId
  ) {
    return res.status(409).json({
      message: "Assign a delivery person before marking this order out for delivery"
    });
  }
  const now = new Date();
  const estimatedDeliveryAt = getEstimatedDeliveryAt(
    parsed.data.status,
    orderType,
    now
  );
  const isCompleted = ["delivered", "completed", "cancelled"].includes(
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
    console.warn("Order status update lost an optimistic concurrency race", {
      requestId: res.locals.requestId,
      orderId,
      currentStatus,
      requestedStatus
    });
    return res.status(409).json({
      message: "Order status changed before this update completed. Refresh and try again."
    });
  }

  const assignedStaffId = (
    order as unknown as { deliveryAgent?: { staffId?: string } }
  ).deliveryAgent?.staffId;
  if (
    assignedStaffId &&
    (["delivered", "completed", "cancelled"] as string[]).includes(parsed.data.status)
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
    void createInAppNotification(
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
    ).catch((error) => {
      console.warn("Order status changed, but the in-app notification failed.", error);
    });
  }

  const orderEmail = (order as unknown as { email?: string }).email ?? parsed.data.email;
  if (orderEmail) {
    void sendOrderEmail(
      orderEmail,
      "Al-Arab order update",
      `<p>Status: ${order.status}</p>`
    ).catch((error) => {
      console.warn("Order status changed, but the email notification failed.", error);
    });
  }
  return res.json(order);
}

export async function cancelOrder(req: Request, res: Response) {
  const orderId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = cancelOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid cancellation details" });
  }
  const { reason, trackingToken } = parsed.data;

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
      const trackedOrder = await findOrderForTracking(
        existingOrder.orderNumber,
        trackingToken
      );
      if (!trackedOrder) {
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
      { _id: existingOrder._id, status: { $in: allowedStatuses } },
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
    return res.status(409).json({
      message: "Order status changed before cancellation completed. Refresh and try again."
    });
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

export async function markOrderPaymentReceived(req: Request, res: Response) {
  const orderId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const order = isMongoConnected()
    ? mongoose.Types.ObjectId.isValid(orderId)
      ? await Order.findById(orderId)
      : await Order.findOne({ orderNumber: orderId })
    : await getLocalOrder(orderId);

  if (!order) return res.status(404).json({ message: "Order not found" });
  if (order.paymentMethod !== "cash_on_delivery") {
    return res.status(409).json({
      message: "Only cash orders can be marked received manually"
    });
  }
  if (order.paymentStatus === "refunded" || order.status === "cancelled") {
    return res.status(409).json({
      message: "Cancelled or refunded orders cannot be marked paid"
    });
  }
  if (order.paymentStatus === "paid") return res.json(order);

  let updatedOrder;
  if (isMongoConnected()) {
    updatedOrder = await Order.findOneAndUpdate(
      {
        _id: order._id,
        paymentMethod: "cash_on_delivery",
        paymentStatus: { $in: ["pending", "failed"] },
        status: { $ne: "cancelled" }
      },
      { $set: { paymentStatus: "paid" } },
      { new: true, runValidators: true }
    );
    if (updatedOrder) {
      await Payment.findOneAndUpdate(
        { order: updatedOrder._id, provider: "cash_on_delivery" },
        {
          $set: {
            amount: Math.round(Number(updatedOrder.total) * 100),
            currency: "INR",
            status: "collected"
          }
        },
        { upsert: true, runValidators: true }
      );
    }
  } else {
    updatedOrder = await updateLocalOrder(order.id, { paymentStatus: "paid" });
  }

  if (!updatedOrder) {
    return res.status(409).json({
      message: "Payment state changed before this update completed. Refresh and try again."
    });
  }

  const trackingUpdate = toPublicOrderTracking(updatedOrder);
  const io = req.app.get("io");
  if (io) {
    io.to(orderTrackingRoom(trackingUpdate.orderNumber)).emit("order:payment", trackingUpdate);
    io.to("orders:staff").emit("order_updated", trackingUpdate);
  }
  return res.json(updatedOrder);
}
