import type { UserRole } from "../models/User";

export type CustomerOrderType = "delivery" | "takeaway" | "dine_in";

type RequestUser = {
  id: string;
  role: UserRole;
} | undefined;

export type OrderAuthenticationDecision =
  | {
      allowed: true;
      customerId?: string;
      idempotencySubject: string;
      isGuestOrder: boolean;
    }
  | {
      allowed: false;
      status: 401;
      code: "ORDER_AUTHENTICATION_REQUIRED";
      message: string;
    };

export function getOrderAuthenticationDecision(
  orderType: CustomerOrderType,
  user: RequestUser
): OrderAuthenticationDecision {
  if (user?.role === "customer") {
    return {
      allowed: true,
      customerId: user.id,
      idempotencySubject: user.id,
      isGuestOrder: false
    };
  }

  if (orderType === "dine_in") {
    return {
      allowed: true,
      idempotencySubject: "guest-dine-in",
      isGuestOrder: true
    };
  }

  return {
    allowed: false,
    status: 401,
    code: "ORDER_AUTHENTICATION_REQUIRED",
    message: orderType === "delivery"
      ? "Please sign in to continue with delivery."
      : "Please sign in to continue with takeaway."
  };
}
