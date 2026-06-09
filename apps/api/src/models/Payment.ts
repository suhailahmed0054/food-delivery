import mongoose, { Schema } from "mongoose";

const paymentSchema = new Schema(
  {
    order: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    provider: { type: String, enum: ["razorpay", "cash_on_delivery"], required: true },
    providerOrderId: String,
    providerPaymentId: String,
    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    status: { type: String, enum: ["created", "verified", "failed", "collected"], default: "created" },
    rawPayload: Schema.Types.Mixed
  },
  { timestamps: true }
);

export const Payment = mongoose.models.Payment || mongoose.model("Payment", paymentSchema);
