import type { CartCustomization } from "@/store/cart-store";

export type SavedOrderItem = {
  itemId?: string;
  name: string;
  quantity: number;
  unitPrice?: number;
  total: number;
  customization?: CartCustomization;
};

export type SavedOrder = {
  id: string;
  customer: string;
  phone: string;
  email?: string;
  address: string;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  deliveryDistanceKm?: number;
  deliveryTime: string;
  instructions: string;
  paymentMethod: "cash_on_delivery" | "razorpay";
  paymentStatus: "pending" | "paid" | "failed" | "refunded";
  refundStatus?: "pending" | "processed" | "failed";
  refundAmount?: number;
  razorpayRefundId?: string;
  orderType: "delivery" | "takeaway" | "dine_in";
  tableNumber?: string;
  status: string;
  trackingToken?: string;
  estimatedDeliveryAt?: string;
  updatedAt?: string;
  completedAt?: string;
  statusHistory?: Array<{
    status: string;
    at: string;
  }>;
  deliveryAgent?: {
    name?: string;
    phone?: string;
    location?: {
      lat?: number;
      lng?: number;
    };
  };
  items: SavedOrderItem[];
  subtotal: number;
  discount: number;
  couponCode?: string;
  tax: number;
  deliveryFee: number;
  total: number;
  createdAt: string;
};

const TRACKING_TOKEN_SESSION_KEY = "al-arab-order-tracking-tokens";

function readTrackingTokens() {
  if (typeof window === "undefined") return {} as Record<string, string>;
  try {
    const parsed = JSON.parse(
      window.sessionStorage.getItem(TRACKING_TOKEN_SESSION_KEY) ?? "{}"
    ) as unknown;
    return parsed && typeof parsed === "object"
      ? parsed as Record<string, string>
      : {};
  } catch {
    return {} as Record<string, string>;
  }
}

export function saveOrderTrackingToken(orderNumber: string, token?: string) {
  if (
    typeof window === "undefined" ||
    !token ||
    token.length < 32 ||
    token.length > 128
  ) return;
  const tokens = readTrackingTokens();
  tokens[orderNumber] = token;
  window.sessionStorage.setItem(
    TRACKING_TOKEN_SESSION_KEY,
    JSON.stringify(tokens)
  );
}

export function serializeSavedOrders(orders: SavedOrder[]) {
  return JSON.stringify(orders.slice(0, 50).map((order) => ({
    ...order,
    customer: "",
    phone: "",
    email: undefined,
    address: "",
    deliveryLatitude: undefined,
    deliveryLongitude: undefined,
    instructions: "",
    trackingToken: undefined,
    deliveryAgent: order.deliveryAgent
      ? { name: order.deliveryAgent.name }
      : undefined
  })));
}

function isSavedOrderItem(value: unknown): value is SavedOrderItem {
  if (!value || typeof value !== "object") return false;

  const item = value as Partial<SavedOrderItem>;
  return (
    typeof item.name === "string" &&
    item.name.trim().length > 0 &&
    typeof item.quantity === "number" &&
    Number.isInteger(item.quantity) &&
    item.quantity > 0 &&
    typeof item.total === "number" &&
    Number.isFinite(item.total)
  );
}

function isSavedOrder(value: unknown): value is SavedOrder {
  if (!value || typeof value !== "object") return false;

  const order = value as Partial<SavedOrder>;
  return (
    typeof order.id === "string" &&
    typeof order.status === "string" &&
    typeof order.total === "number" &&
    Number.isFinite(order.total) &&
    typeof order.createdAt === "string" &&
    !Number.isNaN(Date.parse(order.createdAt)) &&
    Array.isArray(order.items) &&
    order.items.every(isSavedOrderItem)
  );
}

export function parseSavedOrders(stored: string | null) {
  if (!stored) return [];

  try {
    const parsed: unknown = JSON.parse(stored);
    const trackingTokens = readTrackingTokens();
    return Array.isArray(parsed)
      ? parsed.filter(isSavedOrder).map((order) => {
          if (order.trackingToken) {
            saveOrderTrackingToken(order.id, order.trackingToken);
            trackingTokens[order.id] = order.trackingToken;
          }
          const legacyRefundStatus = (order as unknown as {
            refundStatus?: string;
          }).refundStatus;
          const normalized = legacyRefundStatus !== "simulated" ? order : {
            ...order,
            paymentStatus: order.paymentStatus === "refunded" ? "paid" as const : order.paymentStatus,
            refundStatus: "failed" as const
          };
          return {
            ...normalized,
            trackingToken: trackingTokens[order.id]
          };
        })
      : [];
  } catch {
    return [];
  }
}
