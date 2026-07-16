import mongoose, { Schema } from "mongoose";

const paymentSchema = new Schema(
  {
    order: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    provider: { type: String, enum: ["razorpay", "cash_on_delivery"], required: true },
    providerOrderId: { type: String, index: true, sparse: true },
    providerPaymentId: { type: String, index: true, sparse: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    status: { type: String, enum: ["created", "verified", "failed", "collected"], default: "created" },
    providerRefundId: { type: String, index: true, sparse: true },
    refundAmount: { type: Number, min: 0 },
    refundStatus: { type: String, enum: ["pending", "processed", "failed"] },
    rawPayload: Schema.Types.Mixed,
    webhookEventIds: { type: [String], default: [] }
  },
  { timestamps: true }
);

paymentSchema.index({ order: 1, provider: 1 }, { unique: true });

export const Payment = mongoose.models.Payment || mongoose.model("Payment", paymentSchema);
