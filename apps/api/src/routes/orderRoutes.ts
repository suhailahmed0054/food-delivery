import { Router } from "express";
import { createOrder, listOrders, updateOrderStatus } from "../controllers/orderController";
import { requireAuth, requireRole } from "../middleware/auth";

export const orderRouter = Router();

orderRouter.get("/", requireAuth, listOrders);
orderRouter.post("/", requireAuth, requireRole("customer", "admin"), createOrder);
orderRouter.patch("/:id/status", requireAuth, requireRole("admin", "kitchen"), updateOrderStatus);
