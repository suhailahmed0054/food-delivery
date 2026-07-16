import mongoose, { Schema } from "mongoose";

export type DeliveryPersonStatus = "available" | "busy" | "offline";

const deliveryPersonSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    phone: { type: String, required: true, trim: true, unique: true, index: true, maxlength: 20 },
    status: {
      type: String,
      enum: ["available", "busy", "offline"],
      default: "available",
      index: true
    }
  },
  { timestamps: true }
);

export const DeliveryPerson =
  mongoose.models.DeliveryPerson ||
  mongoose.model("DeliveryPerson", deliveryPersonSchema);
