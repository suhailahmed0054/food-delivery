import mongoose, { Schema, type Model, type Types } from "mongoose";

export type RestaurantSettingsRecord = {
  _id: Types.ObjectId;
  key: string;
  restaurantName: string;
  phone: string;
  address: string;
  openingTime: string;
  closingTime: string;
  deliveryEnabled: boolean;
  dineInEnabled: boolean;
  restaurantOpen: boolean;
  deliveryFee: number;
  taxRate: number;
  minimumOrder: number;
  cashEnabled: boolean;
  onlinePaymentEnabled: boolean;
  whatsappTemplate?: string;
  createdAt: Date;
  updatedAt: Date;
};

const restaurantSettingsSchema = new Schema<RestaurantSettingsRecord>(
  {
    key: { type: String, default: "restaurant", unique: true },
    restaurantName: { type: String, required: true, trim: true, maxlength: 150 },
    phone: { type: String, required: true, trim: true, maxlength: 30 },
    address: { type: String, required: true, trim: true, maxlength: 500 },
    openingTime: { type: String, required: true },
    closingTime: { type: String, required: true },
    deliveryEnabled: { type: Boolean, default: true },
    dineInEnabled: { type: Boolean, default: true },
    restaurantOpen: { type: Boolean, default: false },
    deliveryFee: { type: Number, min: 0, default: 39 },
    taxRate: { type: Number, min: 0, max: 1, default: 0.05 },
    minimumOrder: { type: Number, min: 0, default: 299 },
    cashEnabled: { type: Boolean, default: true },
    onlinePaymentEnabled: { type: Boolean, default: false },
    whatsappTemplate: { type: String, maxlength: 2000 }
  },
  { timestamps: true }
);

export const RestaurantSettings =
  (mongoose.models.RestaurantSettings as
    | Model<RestaurantSettingsRecord>
    | undefined) ??
  mongoose.model<RestaurantSettingsRecord>(
    "RestaurantSettings",
    restaurantSettingsSchema
  );
