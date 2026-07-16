import mongoose, { Schema } from "mongoose";

const reviewSchema = new Schema(
  {
    customer: { type: Schema.Types.ObjectId, ref: "User" },
    customerName: { type: String, trim: true, maxlength: 100, default: "Verified customer" },
    order: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    menuItem: { type: Schema.Types.ObjectId, ref: "MenuItem", required: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, maxlength: 1000 }
  },
  { timestamps: true }
);

reviewSchema.index({ order: 1, menuItem: 1 }, { unique: true });
reviewSchema.index({ menuItem: 1, createdAt: -1 });
reviewSchema.index({ createdAt: -1 });

export const Review = mongoose.models.Review || mongoose.model("Review", reviewSchema);
