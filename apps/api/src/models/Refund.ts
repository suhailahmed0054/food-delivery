import mongoose, { Schema } from "mongoose";

const refundSchema = new Schema(
  {
    order: { type: Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    issue: { type: Schema.Types.ObjectId, ref: "Issue", index: true, sparse: true },
    provider: { type: String, enum: ["razorpay"], default: "razorpay" },
    providerPaymentId: { type: String, required: true, index: true },
    providerRefundId: { type: String, unique: true, index: true, sparse: true },
    idempotencyKey: { type: String, required: true, unique: true, index: true },
    amount: { type: Number, required: true, min: 1 },
    currency: { type: String, default: "INR" },
    status: {
      type: String,
      enum: ["pending", "processed", "failed"],
      default: "pending"
    },
    reason: { type: String, maxlength: 500 },
    errorMessage: { type: String, maxlength: 1000 },
    rawPayload: Schema.Types.Mixed,
    webhookEventIds: { type: [String], default: [] }
  },
  { timestamps: true }
);

export const Refund = mongoose.models.Refund || mongoose.model("Refund", refundSchema);
