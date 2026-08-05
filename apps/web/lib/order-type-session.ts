export type CustomerOrderType = "delivery" | "takeaway" | "dine_in";

const STORAGE_KEY = "al-arab-order-type";

export function readCustomerOrderType(): CustomerOrderType {
  if (typeof window === "undefined") return "delivery";
  const value = window.sessionStorage.getItem(STORAGE_KEY);
  return value === "takeaway" || value === "dine_in" ? value : "delivery";
}

export function persistCustomerOrderType(orderType: CustomerOrderType) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(STORAGE_KEY, orderType);
}

export function parseCustomerOrderType(value: unknown): CustomerOrderType | null {
  return value === "delivery" || value === "takeaway" || value === "dine_in"
    ? value
    : null;
}

export function orderTypeRequiresAuthentication(
  orderType: CustomerOrderType
) {
  return orderType !== "dine_in";
}

export function getOrderTypeAuthenticationMessage(
  orderType: CustomerOrderType
) {
  if (orderType === "delivery") {
    return "Please sign in to continue with delivery.";
  }
  if (orderType === "takeaway") {
    return "Please sign in to continue with takeaway.";
  }
  return "Continue as guest";
}
