import { mkdir, readFile } from "fs/promises";
import path from "path";
import { writeJsonFileAtomic } from "./localFileStore";

export type LocalOrder = {
  id: string;
  orderNumber: string;
  customer?: string;
  customerName?: string;
  items: Array<{
    menuItem?: string;
    name: string;
    quantity: number;
    price: number;
    customization?: {
      size: string;
      spiceLevel: string;
      addOns: string[];
    };
  }>;
  subtotal?: number;
  total: number;
  tax?: number;
  deliveryFee?: number;
  discount?: number;
  couponCode?: string;
  status: string;
  paymentMethod?: "cash_on_delivery" | "razorpay";
  paymentStatus?: "pending" | "paid" | "failed" | "refunded";
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  orderType: "delivery" | "dine_in";
  table?: string;
  tableNumber?: string;
  phone?: string;
  customerPhoneNormalized?: string;
  email?: string;
  address?: string;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  deliveryDistanceKm?: number;
  deliveryTime?: string;
  specialInstructions?: string;
  trackingTokenHash?: string;
  estimatedDeliveryAt?: string;
  statusHistory?: Array<{
    status: string;
    at: string;
  }>;
  deliveryAgent?: {
    staffId: string;
    name: string;
    phone: string;
  };
  cancellationReason?: string;
  cancelledAt?: string;
  cancelledBy?: "customer" | "admin";
  cancelReason?: string;
  refundStatus?: "pending" | "processed" | "failed";
  refundAmount?: number;
  razorpayRefundId?: string;
  refundError?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type LocalOrderInput = Omit<LocalOrder, "id" | "createdAt" | "updatedAt">;

const dataDir = path.resolve(__dirname, "../../data");
const dataFile = path.join(dataDir, "orders.json");

async function ensureStore() {
  await mkdir(dataDir, { recursive: true });
  try {
    await readFile(dataFile, "utf8");
  } catch {
    await writeJsonFileAtomic(dataFile, []);
  }
}

async function writeLocalOrders(orders: LocalOrder[]) {
  await ensureStore();
  await writeJsonFileAtomic(dataFile, orders);
}

export async function listLocalOrders() {
  await ensureStore();

  try {
    const parsed = JSON.parse(await readFile(dataFile, "utf8")) as unknown;
    if (!Array.isArray(parsed)) return [];
    return (parsed as LocalOrder[]).map((order) =>
      (order as unknown as { refundStatus?: string }).refundStatus === "simulated"
        ? {
            ...order,
            paymentStatus: order.paymentStatus === "refunded" ? "paid" : order.paymentStatus,
            refundStatus: "failed" as const,
            refundError: "Legacy simulated refund requires manual reconciliation"
          }
        : order
    );
  } catch {
    return [];
  }
}

export async function getLocalOrder(id: string) {
  const orders = await listLocalOrders();
  return orders.find((order) => order.id === id || order.orderNumber === id) ?? null;
}

export async function createLocalOrder(input: LocalOrderInput) {
  const orders = await listLocalOrders();
  const now = new Date().toISOString();
  const order: LocalOrder = {
    ...input,
    id: input.orderNumber,
    createdAt: now,
    updatedAt: now
  };

  await writeLocalOrders([order, ...orders].slice(0, 500));
  return order;
}

export async function updateLocalOrderStatus(
  id: string,
  status: string,
  estimatedDeliveryAt?: string
) {
  const orders = await listLocalOrders();
  const index = orders.findIndex((order) => order.id === id || order.orderNumber === id);
  if (index === -1) return null;

  const currentOrder = orders[index];
  const now = new Date().toISOString();
  const isCompleted = ["delivered", "served", "cancelled"].includes(status);
  const nextOrder: LocalOrder = {
    ...currentOrder,
    status,
    updatedAt: now,
    estimatedDeliveryAt,
    statusHistory:
      currentOrder.status === status
        ? currentOrder.statusHistory
        : [
            ...(currentOrder.statusHistory ?? [
              { status: currentOrder.status, at: currentOrder.createdAt }
            ]),
            { status, at: now }
          ],
    completedAt: isCompleted
      ? currentOrder.status === status && currentOrder.completedAt
        ? currentOrder.completedAt
        : now
      : undefined
  };
  orders[index] = nextOrder;
  await writeLocalOrders(orders);
  return orders[index];
}

export async function setLocalOrderTracking(
  id: string,
  trackingTokenHash: string,
  estimatedDeliveryAt?: string
) {
  const orders = await listLocalOrders();
  const index = orders.findIndex(
    (order) => order.id === id || order.orderNumber === id
  );
  if (index === -1) return null;

  const currentOrder = orders[index];
  orders[index] = {
    ...currentOrder,
    trackingTokenHash,
    estimatedDeliveryAt,
    statusHistory:
      currentOrder.statusHistory?.length
        ? currentOrder.statusHistory
        : [{ status: currentOrder.status, at: currentOrder.createdAt }],
    updatedAt: new Date().toISOString()
  };
  await writeLocalOrders(orders);
  return orders[index];
}

export async function assignLocalOrderCustomer(id: string, customer: string) {
  const orders = await listLocalOrders();
  const index = orders.findIndex(
    (order) => order.id === id || order.orderNumber === id
  );
  if (index === -1) return null;

  orders[index] = {
    ...orders[index],
    customer,
    updatedAt: new Date().toISOString()
  };
  await writeLocalOrders(orders);
  return orders[index];
}

export async function assignLocalOrderDelivery(
  id: string,
  deliveryAgent: { staffId: string; name: string; phone: string }
) {
  const orders = await listLocalOrders();
  const index = orders.findIndex((order) => order.id === id || order.orderNumber === id);
  if (index === -1) return null;

  orders[index] = {
    ...orders[index],
    deliveryAgent,
    updatedAt: new Date().toISOString()
  };
  await writeLocalOrders(orders);
  return orders[index];
}

export async function updateLocalOrder(
  id: string,
  updateFields: Partial<LocalOrder>
) {
  const orders = await listLocalOrders();
  const index = orders.findIndex((order) => order.id === id || order.orderNumber === id);
  if (index === -1) return null;

  orders[index] = {
    ...orders[index],
    ...updateFields,
    updatedAt: new Date().toISOString()
  };
  await writeLocalOrders(orders);
  return orders[index];
}
