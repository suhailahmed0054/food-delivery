import mongoose, { Schema } from "mongoose";

const menuItemSchema = new Schema(
  {
    name: { type: String, required: true },
    category: { type: String, required: true },
    price: { type: Number, required: true },
    description: { type: String, required: true },
    image: { type: String, required: true },
    imagePublicId: { type: String, select: false },
    rating: { type: Number, default: 0 },
    reviews: { type: Number, default: 0 },
    ingredients: [String],
    allergens: [String],
    customization: {
      sizes: [{ name: String, priceDelta: Number }],
      spiceLevels: [String],
      addOns: [{ name: String, price: Number }]
    },
    available: { type: Boolean, default: true }
  },
  { timestamps: true }
);

menuItemSchema.index({ category: 1, name: 1 });

export const MenuItem = mongoose.models.MenuItem || mongoose.model("MenuItem", menuItemSchema);
