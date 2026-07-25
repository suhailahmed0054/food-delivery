import mongoose, { Schema, type Model, type Types } from "mongoose";

export type UserRole = "customer" | "admin" | "kitchen";

export type CustomerAddress = {
  id: string;
  label: string;
  address: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
  isDefault: boolean;
};

export type CustomerNotificationPreferences = {
  orderUpdates: boolean;
  offers: boolean;
};

export type UserRecord = {
  _id: Types.ObjectId;
  name: string;
  email: string;
  emailVerified: boolean;
  passwordHash?: string;
  phone?: string;
  addresses: CustomerAddress[];
  notificationPreferences: CustomerNotificationPreferences;
  role: UserRole;
  refreshTokenHash?: string;
  isBlocked: boolean;
  blockedAt?: Date;
  blockReason?: string;
  adminNotes?: string;
  createdAt: Date;
  updatedAt: Date;
};

const userSchema = new Schema<UserRecord>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    emailVerified: { type: Boolean, default: false },
    passwordHash: { type: String, select: false },
    phone: { type: String },
    addresses: [
      {
        _id: false,
        id: { type: String, required: true },
        label: { type: String, required: true, maxlength: 50 },
        address: { type: String, required: true, maxlength: 1000 },
        phone: { type: String, maxlength: 30 },
        latitude: { type: Number, min: -90, max: 90 },
        longitude: { type: Number, min: -180, max: 180 },
        isDefault: { type: Boolean, default: false }
      }
    ],
    notificationPreferences: {
      orderUpdates: { type: Boolean, default: true },
      offers: { type: Boolean, default: true }
    },
    role: { type: String, enum: ["customer", "admin", "kitchen"], default: "customer" },
    refreshTokenHash: { type: String },
    isBlocked: { type: Boolean, default: false, index: true },
    blockedAt: { type: Date },
    blockReason: { type: String, maxlength: 500 },
    adminNotes: { type: String, maxlength: 2000 }
  },
  { timestamps: true }
);

userSchema.index({ role: 1, isBlocked: 1, createdAt: -1 });

export const User =
  (mongoose.models.User as Model<UserRecord> | undefined) ??
  mongoose.model<UserRecord>("User", userSchema);
