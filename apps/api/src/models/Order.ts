import mongoose, { Schema } from "mongoose";

const orderSchema = new Schema(
  {
    customer: { type: Schema.Types.ObjectId, ref: "User" },
    items: [
      {
        menuItem: { type: Schema.Types.ObjectId, ref: "MenuItem" },
        name: String,
        quantity: Number,
        price: Number
      }
    ],
    total: { type: Number, required: true },
    tax: { type: Number, default: 0 },
    deliveryFee: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["placed", "accepted", "preparing", "ready", "ready_for_pickup", "out_for_delivery", "delivered", "cancelled"],
      default: "placed"
    },
    paymentMethod: { type: String, enum: ["cash_on_delivery", "razorpay"], default: "cash_on_delivery" },
    paymentStatus: { type: String, enum: ["pending", "paid", "failed"], default: "pending" },
    razorpayOrderId: String,
    address: String,
    deliveryTime: { type: String, default: "ASAP" },
    specialInstructions: String,
    preparationTime: String,
    cancellationReason: String,
    deliveryAgent: {
      name: String,
      phone: String,
      location: {
        lat: Number,
        lng: Number
      }
    }
  },
  { timestamps: true }
);

export const Order = mongoose.models.Order || mongoose.model("Order", orderSchema);
