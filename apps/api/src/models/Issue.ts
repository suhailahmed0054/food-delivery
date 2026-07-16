import mongoose, { Schema } from "mongoose";

const issueSchema = new Schema(
  {
    order: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    orderNumber: { type: String, required: true },
    customer: { type: Schema.Types.ObjectId, ref: "User" },
    customerName: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String },
    category: {
      type: String,
      enum: ["missing_items", "wrong_items", "poor_quality", "delivery_delay", "other"],
      required: true
    },
    description: { type: String, required: true },
    desiredResolution: {
      type: String,
      enum: ["refund", "redelivery", "feedback"],
      required: true
    },
    status: {
      type: String,
      enum: ["open", "investigating", "resolved", "refunded", "closed"],
      default: "open"
    },
    resolutionDetails: { type: String, default: "" },
    refundAmount: { type: Number, default: 0 },
    images: {
      type: [String],
      default: []
    },
    chatStatus: {
      type: String,
      enum: ["waiting", "active", "closed"],
      default: "waiting"
    },
    assignedAgent: { type: Schema.Types.ObjectId, ref: "User" },
    assignedAgentName: { type: String, default: "" },
    lastMessage: { type: String, default: "" },
    lastMessageAt: { type: Date },
    resolutionType: {
      type: String,
      enum: ["none", "refund", "partial_refund", "replacement", "coupon", "rejected", "resolved"],
      default: "none"
    },
    decisionReason: { type: String, default: "" },
    refundApproved: { type: Boolean, default: false },
    refundStatus: {
      type: String,
      enum: ["none", "pending", "processed", "failed"],
      default: "none"
    },
    razorpayRefundId: { type: String, index: true, sparse: true },
    closedAt: { type: Date }
  },
  { timestamps: true }
);

issueSchema.index({ status: 1, createdAt: -1 });
issueSchema.index({ assignedAgent: 1, status: 1, updatedAt: -1 });
issueSchema.index({ orderNumber: 1 });

export const Issue = mongoose.models.Issue || mongoose.model("Issue", issueSchema);
