import mongoose, { Schema } from "mongoose";

const notificationSchema = new Schema(
  {
    audience: {
      type: String,
      enum: ["admin", "customer"],
      required: true,
      index: true
    },
    recipient: { type: Schema.Types.ObjectId, ref: "User", index: true },
    type: {
      type: String,
      enum: ["order", "payment", "delivery", "support", "system"],
      required: true
    },
    title: { type: String, required: true, maxlength: 120 },
    message: { type: String, required: true, maxlength: 500 },
    href: { type: String, maxlength: 500 },
    orderNumber: { type: String, index: true },
    supportIssueId: { type: String, index: true },
    dedupeKey: { type: String, required: true, unique: true, index: true },
    readAt: { type: Date }
  },
  { timestamps: true }
);

notificationSchema.index({ audience: 1, recipient: 1, createdAt: -1 });

export const Notification =
  mongoose.models.Notification ||
  mongoose.model("Notification", notificationSchema);
