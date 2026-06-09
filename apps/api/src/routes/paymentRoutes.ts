import { Router } from "express";
import { createRazorpayOrder, verifyRazorpayWebhook } from "../controllers/paymentController";

export const paymentRouter = Router();

paymentRouter.post("/create-order", createRazorpayOrder);
paymentRouter.post("/webhook", verifyRazorpayWebhook);
