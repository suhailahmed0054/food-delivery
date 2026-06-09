import crypto from "crypto";
import { Request, Response } from "express";
import Razorpay from "razorpay";
import { env } from "../config/env";

export async function createRazorpayOrder(req: Request, res: Response) {
  const amount = Number(req.body.amount ?? 0);
  if (!amount) return res.status(400).json({ message: "Amount is required" });

  if (!env.razorpayKeyId || !env.razorpayKeySecret) {
    return res.json({ id: "demo_order", amount: amount * 100, currency: "INR", mode: "demo" });
  }

  const razorpay = new Razorpay({ key_id: env.razorpayKeyId, key_secret: env.razorpayKeySecret });
  const order = await razorpay.orders.create({
    amount: amount * 100,
    currency: "INR",
    receipt: `al-arab-${Date.now()}`
  });
  return res.json(order);
}

export function verifyRazorpayWebhook(req: Request, res: Response) {
  const signature = req.headers["x-razorpay-signature"];
  const body = JSON.stringify(req.body);
  const expected = crypto.createHmac("sha256", env.razorpayWebhookSecret).update(body).digest("hex");

  if (!signature || signature !== expected) {
    return res.status(400).json({ message: "Invalid webhook signature" });
  }

  req.app.get("io")?.emit("payment:webhook", req.body);
  return res.json({ received: true });
}
