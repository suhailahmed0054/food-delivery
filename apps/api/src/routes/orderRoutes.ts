import { Router } from "express";
import {
  assignOrderDelivery,
  claimOrderTracking,
  createOrder,
  getOrderTracking,
  listOrders,
  quoteOrder,
  updateOrderStatus,
  cancelOrder
} from "../controllers/orderController";
import {
  optionalCustomerAuth,
  requireAuth,
  requireRole
} from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { rateLimit } from "../middleware/rateLimit";

export const orderRouter = Router();

orderRouter.get("/", requireAuth, requireRole("admin", "kitchen"), asyncHandler(listOrders));
orderRouter.post("/quote", rateLimit(30, 60_000, "order-quote"), asyncHandler(quoteOrder));
orderRouter.post("/", rateLimit(10, 5 * 60_000, "order-create"), optionalCustomerAuth, asyncHandler(createOrder));
orderRouter.post("/:id/tracking", rateLimit(30, 60_000, "order-tracking"), asyncHandler(getOrderTracking));
orderRouter.post("/:id/tracking/claim", rateLimit(5, 15 * 60_000, "tracking-claim"), asyncHandler(claimOrderTracking));
orderRouter.patch("/:id/status", requireAuth, requireRole("admin", "kitchen"), asyncHandler(updateOrderStatus));
orderRouter.post("/:id/cancel", rateLimit(10, 15 * 60_000, "order-cancel"), optionalCustomerAuth, asyncHandler(cancelOrder));
orderRouter.patch(
  "/:id/assign-delivery",
  requireAuth,
  requireRole("admin"),
  asyncHandler(assignOrderDelivery)
);
