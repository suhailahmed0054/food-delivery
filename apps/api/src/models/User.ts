import mongoose, { Schema } from "mongoose";

export type UserRole = "customer" | "admin" | "kitchen";

const userSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String },
    googleId: { type: String },
    phone: { type: String },
    role: { type: String, enum: ["customer", "admin", "kitchen"], default: "customer" },
    refreshTokenHash: { type: String }
  },
  { timestamps: true }
);

export const User = mongoose.models.User || mongoose.model("User", userSchema);
