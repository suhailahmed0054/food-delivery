export const orderStatusValues = [
  "pending",
  "placed",
  "accepted",
  "preparing",
  "ready",
  "ready_for_pickup",
  "out_for_delivery",
  "served",
  "collected",
  "delivered",
  "completed",
  "cancelled"
] as const;

export type OrderStatus = (typeof orderStatusValues)[number];
export type OrderFulfilmentType = "delivery" | "takeaway" | "dine_in";
export type OrderStatusRole = "admin" | "kitchen";

const deliveryStatusTransitions: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ["accepted", "cancelled"],
  placed: ["accepted", "cancelled"],
  accepted: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["out_for_delivery", "cancelled"],
  ready_for_pickup: ["out_for_delivery", "cancelled"],
  out_for_delivery: ["delivered"],
  served: [],
  collected: [],
  delivered: [],
  completed: [],
  cancelled: []
};

const takeawayStatusTransitions: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ["accepted", "cancelled"],
  placed: ["accepted", "cancelled"],
  accepted: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["collected", "cancelled"],
  ready_for_pickup: ["collected", "cancelled"],
  out_for_delivery: [],
  served: [],
  collected: ["completed"],
  delivered: [],
  completed: [],
  cancelled: []
};

const dineInStatusTransitions: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ["accepted", "cancelled"],
  placed: ["accepted", "cancelled"],
  accepted: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["served"],
  ready_for_pickup: ["served"],
  out_for_delivery: [],
  served: ["completed"],
  collected: [],
  delivered: [],
  completed: [],
  cancelled: []
};

const kitchenStatusTransitions: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ["preparing"],
  placed: ["preparing"],
  accepted: ["preparing"],
  preparing: ["ready", "ready_for_pickup"],
  ready: [],
  ready_for_pickup: [],
  out_for_delivery: [],
  served: [],
  collected: [],
  delivered: [],
  completed: [],
  cancelled: []
};

export function getAllowedNextOrderStatuses(
  currentStatus: string,
  orderType: OrderFulfilmentType,
  role: OrderStatusRole
): readonly OrderStatus[] {
  if (!orderStatusValues.includes(currentStatus as OrderStatus)) return [];

  const normalizedStatus = currentStatus as OrderStatus;
  if (role === "kitchen") return kitchenStatusTransitions[normalizedStatus];

  if (orderType === "dine_in") {
    return dineInStatusTransitions[normalizedStatus];
  }
  if (orderType === "takeaway") {
    return takeawayStatusTransitions[normalizedStatus];
  }
  return deliveryStatusTransitions[normalizedStatus];
}
