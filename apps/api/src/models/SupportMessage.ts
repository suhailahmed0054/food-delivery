import mongoose, { Schema } from "mongoose";

const supportMessageSchema = new Schema(
  {
    issue: { type: Schema.Types.ObjectId, ref: "Issue", required: true },
    order: { type: Schema.Types.ObjectId, ref: "Order" },
    sender: { type: Schema.Types.ObjectId, ref: "User" },
    senderType: {
      type: String,
      enum: ["customer", "guest", "agent", "admin", "system"],
      required: true
    },
    senderName: { type: String, required: true },
    message: { type: String, required: true },
    images: { type: [String], default: [] },
    imagePublicIds: { type: [String], default: [], select: false },
    readAt: { type: Date }
  },
  { timestamps: true }
);

supportMessageSchema.index({ issue: 1, createdAt: -1 });

export const SupportMessage =
  mongoose.models.SupportMessage || mongoose.model("SupportMessage", supportMessageSchema);
