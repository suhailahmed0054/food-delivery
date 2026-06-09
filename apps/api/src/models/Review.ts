import mongoose, { Schema } from "mongoose";

const reviewSchema = new Schema(
  {
    customer: { type: Schema.Types.ObjectId, ref: "User", required: true },
    order: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    menuItem: { type: Schema.Types.ObjectId, ref: "MenuItem" },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, maxlength: 1000 }
  },
  { timestamps: true }
);

export const Review = mongoose.models.Review || mongoose.model("Review", reviewSchema);
