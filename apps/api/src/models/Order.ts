import mongoose, { Schema } from "mongoose";

const orderSchema = new Schema(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },
    customer: { type: Schema.Types.ObjectId, ref: "User" },
    customerName: String,
    items: [
      {
        menuItem: { type: Schema.Types.ObjectId, ref: "MenuItem" },
        name: String,
        quantity: Number,
        price: Number,
        customization: {
          size: String,
          spiceLevel: String,
          addOns: [String]
        }
      }
    ],
    subtotal: { type: Number, required: true, default: 0 },
    total: { type: Number, required: true },
    tax: { type: Number, default: 0 },
    deliveryFee: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    couponCode: { type: String, trim: true, uppercase: true, maxlength: 30 },
    status: {
      type: String,
      enum: ["pending", "placed", "accepted", "preparing", "ready", "ready_for_pickup", "out_for_delivery", "served", "delivered", "cancelled"],
      default: "placed"
    },
    paymentMethod: { type: String, enum: ["cash_on_delivery", "razorpay"], default: "cash_on_delivery" },
    paymentStatus: { type: String, enum: ["pending", "paid", "failed", "refunded"], default: "pending" },
    razorpayOrderId: String,
    razorpayPaymentId: String,
    orderType: { type: String, enum: ["delivery", "dine_in"], default: "delivery" },
    table: { type: Schema.Types.ObjectId, ref: "Table" },
    tableNumber: String,
    phone: String,
    customerPhoneNormalized: { type: String, index: true },
    email: { type: String, trim: true, maxlength: 320 },
    address: String,
    deliveryLatitude: Number,
    deliveryLongitude: Number,
    deliveryDistanceKm: Number,
    deliveryTime: { type: String, default: "ASAP" },
    specialInstructions: String,
    preparationTime: String,
    cancellationReason: String,
    cancelledAt: Date,
    cancelledBy: { type: String, enum: ["customer", "admin"] },
    cancelReason: String,
    refundStatus: { type: String, enum: ["pending", "processed", "failed"] },
    refundAmount: { type: Number, min: 0 },
    razorpayRefundId: { type: String, index: true, sparse: true },
    refundError: { type: String, maxlength: 1000 },
    trackingTokenHash: {
      type: String,
      select: false,
      index: true
    },
    idempotencyKeyHash: {
      type: String,
      minlength: 64,
      maxlength: 64,
      select: false
    },
    idempotencyRequestHash: {
      type: String,
      minlength: 64,
      maxlength: 64,
      select: false
    },
    estimatedDeliveryAt: Date,
    statusHistory: [
      {
        _id: false,
        status: { type: String, required: true },
        at: { type: Date, required: true }
      }
    ],
    completedAt: Date,
    deliveryAgent: {
      staffId: String,
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

orderSchema.index({ createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ razorpayOrderId: 1 }, { sparse: true });
orderSchema.index({ razorpayPaymentId: 1 }, { sparse: true });
orderSchema.index(
  { customer: 1, idempotencyKeyHash: 1 },
  {
    unique: true,
    name: "unique_customer_order_idempotency",
    partialFilterExpression: {
      customer: { $exists: true },
      idempotencyKeyHash: { $type: "string" }
    }
  }
);

export const Order = mongoose.models.Order || mongoose.model("Order", orderSchema);
