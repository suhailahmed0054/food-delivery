import { Request, Response } from "express";
import { Order } from "../models/Order";
import { sendOrderEmail, sendSms } from "../services/notificationService";

export async function createOrder(req: Request, res: Response) {
  const order = await Order.create({ ...req.body, customer: req.user?.id });
  req.app.get("io")?.emit("order:created", order);
  await sendSms(req.body.phone ?? "demo", `Al-Arab order ${order.id} placed.`);
  return res.status(201).json(order);
}

export async function listOrders(req: Request, res: Response) {
  const filter = req.user?.role === "customer" ? { customer: req.user.id } : {};
  const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(100);
  return res.json(orders);
}

export async function updateOrderStatus(req: Request, res: Response) {
  const order = await Order.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
  if (!order) return res.status(404).json({ message: "Order not found" });
  req.app.get("io")?.emit("order:status", order);
  await sendOrderEmail(req.body.email ?? "customer@example.com", "Al-Arab order update", `<p>Status: ${order.status}</p>`);
  return res.json(order);
}
