import { Router } from "express";
import {
  createRazorpayOrder,
  verifyRazorpayPayment,
  verifyRazorpayWebhook
} from "../controllers/paymentController";
import { asyncHandler } from "../middleware/asyncHandler";
import { rateLimit } from "../middleware/rateLimit";

export const paymentRouter = Router();

paymentRouter.post(
  "/create-order",
  rateLimit(10, 60_000, "payment-create"),
  asyncHandler(createRazorpayOrder)
);
paymentRouter.post(
  "/verify",
  rateLimit(20, 60_000, "payment-verify"),
  asyncHandler(verifyRazorpayPayment)
);
paymentRouter.post("/webhook", asyncHandler(verifyRazorpayWebhook));
