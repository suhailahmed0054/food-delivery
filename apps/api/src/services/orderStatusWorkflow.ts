export const orderStatusValues = [
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
] as const;

export type OrderStatus = (typeof orderStatusValues)[number];
export type OrderFulfilmentType = "delivery" | "dine_in";
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
  delivered: [],
  cancelled: []
};

const dineInStatusTransitions: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ["accepted", "cancelled"],
  placed: ["accepted", "cancelled"],
  accepted: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["delivered"],
  ready_for_pickup: ["delivered"],
  out_for_delivery: [],
  served: [],
  delivered: [],
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
  delivered: [],
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

  return orderType === "dine_in"
    ? dineInStatusTransitions[normalizedStatus]
    : deliveryStatusTransitions[normalizedStatus];
}
