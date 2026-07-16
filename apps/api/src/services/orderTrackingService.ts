import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { z } from "zod";
import { env } from "../config/env";
import { Order } from "../models/Order";
import {
  assignLocalOrderCustomer,
  getLocalOrder,
  setLocalOrderTracking
} from "./localOrderStore";

export const trackingCredentialsSchema = z.object({
  orderNumber: z.string().trim().regex(/^[A-Za-z0-9-]{4,64}$/),
  trackingToken: z.string().trim().min(32).max(128)
});

export const trackingClaimSchema = z.object({
  phone: z.string().trim().min(7).max(30)
});

export type PublicOrderTracking = {
  orderNumber: string;
  status: string;
  orderType: "delivery" | "dine_in";
  tableNumber?: string;
  paymentStatus?: "pending" | "paid" | "failed" | "refunded";
  refundStatus?: "pending" | "processed" | "failed";
  refundAmount?: number;
  razorpayRefundId?: string;
  deliveryTime?: string;
  estimatedDeliveryAt?: string;
  deliveryAgent?: {
    name?: string;
    phone?: string;
    location?: {
      lat?: number;
      lng?: number;
    };
  };
  statusHistory: Array<{
    status: string;
    at: string;
  }>;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
};

type TrackableOrder = {
  orderNumber?: unknown;
  status?: unknown;
  orderType?: unknown;
  tableNumber?: unknown;
  paymentStatus?: unknown;
  refundStatus?: unknown;
  refundAmount?: unknown;
  razorpayRefundId?: unknown;
  deliveryTime?: unknown;
  estimatedDeliveryAt?: unknown;
  deliveryAgent?: unknown;
  statusHistory?: unknown;
  completedAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  trackingTokenHash?: unknown;
  phone?: unknown;
  toObject?: () => Record<string, unknown>;
};

function toPlainOrder(order: unknown) {
  const trackable = order as TrackableOrder;
  return typeof trackable?.toObject === "function"
    ? trackable.toObject()
    : { ...(trackable as Record<string, unknown>) };
}

function toIsoString(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== "string") return undefined;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function normalizePhone(value: unknown) {
  return typeof value === "string" ? value.replace(/\D/g, "") : "";
}

function hashesMatch(first: string, second: string) {
  const firstBuffer = Buffer.from(first, "hex");
  const secondBuffer = Buffer.from(second, "hex");
  return (
    firstBuffer.length === secondBuffer.length &&
    timingSafeEqual(firstBuffer, secondBuffer)
  );
}

export function createOrderTrackingToken() {
  return randomBytes(32).toString("base64url");
}

export function hashOrderTrackingToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function createLegacyOrderTrackingToken(
  orderNumber: string,
  normalizedPhone: string
) {
  return createHmac("sha256", env.jwtAccessSecret)
    .update(`${orderNumber}:${normalizedPhone}`)
    .digest("base64url");
}

export function getEstimatedDeliveryAt(
  status: string,
  orderType: "delivery" | "dine_in",
  from = new Date()
) {
  const deliveryMinutes: Record<string, number> = {
    pending: 40,
    placed: 40,
    accepted: 35,
    preparing: 25,
    ready: 15,
    ready_for_pickup: 10,
    out_for_delivery: 15
  };
  const dineInMinutes: Record<string, number> = {
    pending: 25,
    placed: 25,
    accepted: 20,
    preparing: 15,
    ready: 5,
    ready_for_pickup: 5
  };
  const minutes =
    (orderType === "dine_in" ? dineInMinutes : deliveryMinutes)[status];

  return minutes === undefined
    ? undefined
    : new Date(from.getTime() + minutes * 60_000).toISOString();
}

export function withoutOrderTrackingSecret(order: unknown) {
  const plain = toPlainOrder(order);
  delete plain.trackingTokenHash;
  return plain;
}

export function toPublicOrderTracking(order: unknown): PublicOrderTracking {
  const plain = toPlainOrder(order);
  const createdAt =
    toIsoString(plain.createdAt) ?? new Date().toISOString();
  const updatedAt = toIsoString(plain.updatedAt) ?? createdAt;
  const history = Array.isArray(plain.statusHistory)
    ? plain.statusHistory.flatMap((entry) => {
        if (!entry || typeof entry !== "object") return [];
        const status = (entry as { status?: unknown }).status;
        const at = toIsoString((entry as { at?: unknown }).at);
        return typeof status === "string" && at ? [{ status, at }] : [];
      })
    : [];
  const status = typeof plain.status === "string" ? plain.status : "placed";
  const orderType = plain.orderType === "dine_in" ? "dine_in" : "delivery";
  const deliveryAgent =
    plain.deliveryAgent && typeof plain.deliveryAgent === "object"
      ? (plain.deliveryAgent as {
          name?: string;
          phone?: string;
          location?: { lat?: number; lng?: number };
        })
      : undefined;

  return {
    orderNumber:
      typeof plain.orderNumber === "string" ? plain.orderNumber : "",
    status,
    orderType,
    tableNumber:
      typeof plain.tableNumber === "string" ? plain.tableNumber : undefined,
    paymentStatus:
      plain.paymentStatus === "paid" ||
      plain.paymentStatus === "failed" ||
      plain.paymentStatus === "refunded"
        ? plain.paymentStatus
        : plain.paymentStatus === "pending"
          ? "pending"
          : undefined,
    refundStatus:
      plain.refundStatus === "pending" ||
      plain.refundStatus === "processed" ||
      plain.refundStatus === "failed"
        ? plain.refundStatus
        : undefined,
    refundAmount:
      typeof plain.refundAmount === "number" && Number.isFinite(plain.refundAmount)
        ? plain.refundAmount
        : undefined,
    razorpayRefundId:
      typeof plain.razorpayRefundId === "string"
        ? plain.razorpayRefundId
        : undefined,
    deliveryTime:
      typeof plain.deliveryTime === "string" ? plain.deliveryTime : undefined,
    estimatedDeliveryAt: toIsoString(plain.estimatedDeliveryAt),
    deliveryAgent: deliveryAgent
      ? {
          name:
            typeof deliveryAgent.name === "string"
              ? deliveryAgent.name
              : undefined,
          phone:
            typeof deliveryAgent.phone === "string"
              ? deliveryAgent.phone
              : undefined,
          location: deliveryAgent.location
        }
      : undefined,
    statusHistory:
      history.length > 0 ? history : [{ status, at: createdAt }],
    completedAt: toIsoString(plain.completedAt),
    createdAt,
    updatedAt
  };
}

export function orderTrackingRoom(orderNumber: string) {
  return `order:${orderNumber}`;
}

export async function findOrderForTracking(
  orderNumber: string,
  trackingToken: string
) {
  const tokenHash = hashOrderTrackingToken(trackingToken);

  if (Order.db.readyState !== 1) {
    const order = await getLocalOrder(orderNumber);
    return order?.trackingTokenHash &&
      hashesMatch(order.trackingTokenHash, tokenHash)
      ? order
      : null;
  }

  return Order.findOne({
    orderNumber,
    trackingTokenHash: tokenHash
  })
    .select("+trackingTokenHash")
    .lean();
}

export async function attachTrackedOrderToCustomer(
  orderNumber: string,
  trackingToken: string,
  customerId: string
) {
  const tokenHash = hashOrderTrackingToken(trackingToken);

  if (Order.db.readyState !== 1) {
    const order = await findOrderForTracking(orderNumber, trackingToken);
    if (!order) return false;
    return Boolean(await assignLocalOrderCustomer(orderNumber, customerId));
  }

  const order = await Order.findOneAndUpdate(
    { orderNumber, trackingTokenHash: tokenHash },
    { customer: customerId },
    { new: true }
  ).select("_id");
  return Boolean(order);
}

export async function claimLegacyOrderTracking(
  orderNumber: string,
  phone: string
) {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return null;

  const trackingToken = createLegacyOrderTrackingToken(
    orderNumber,
    normalizedPhone
  );
  const trackingTokenHash = hashOrderTrackingToken(trackingToken);

  if (Order.db.readyState !== 1) {
    const order = await getLocalOrder(orderNumber);
    if (!order || normalizePhone(order.phone) !== normalizedPhone) return null;
    if (
      order.trackingTokenHash &&
      !hashesMatch(order.trackingTokenHash, trackingTokenHash)
    ) {
      return null;
    }

    const estimatedDeliveryAt =
      order.estimatedDeliveryAt ??
      getEstimatedDeliveryAt(
        order.status,
        order.orderType,
        new Date(order.updatedAt)
      );
    const updated = await setLocalOrderTracking(
      orderNumber,
      trackingTokenHash,
      estimatedDeliveryAt
    );
    return updated
      ? { trackingToken, order: toPublicOrderTracking(updated) }
      : null;
  }

  const order = await Order.findOne({ orderNumber }).select("+trackingTokenHash");
  if (!order || normalizePhone(order.phone) !== normalizedPhone) return null;
  if (
    order.trackingTokenHash &&
    !hashesMatch(order.trackingTokenHash, trackingTokenHash)
  ) {
    return null;
  }

  order.trackingTokenHash = trackingTokenHash;
  if (!order.statusHistory?.length) {
    order.statusHistory = [{ status: order.status, at: order.createdAt }];
  }
  if (!order.estimatedDeliveryAt) {
    const estimate = getEstimatedDeliveryAt(
      order.status,
      order.orderType,
      order.updatedAt
    );
    order.estimatedDeliveryAt = estimate ? new Date(estimate) : undefined;
  }
  await order.save();

  return { trackingToken, order: toPublicOrderTracking(order) };
}
