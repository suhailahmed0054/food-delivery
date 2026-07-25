import mongoose, { Schema, type Model, type Types } from "mongoose";

export type EmailOtpPurpose = "customer-auth";

export type EmailOtpVerificationRecord = {
  _id: Types.ObjectId;
  normalizedEmail: string;
  otpHash: string;
  purpose: EmailOtpPurpose;
  attempts: number;
  expiresAt: Date;
  consumedAt?: Date | null;
  requestIp: string;
  createdAt: Date;
  updatedAt: Date;
};

const emailOtpVerificationSchema = new Schema<EmailOtpVerificationRecord>(
  {
    normalizedEmail: { type: String, required: true, lowercase: true, trim: true },
    otpHash: { type: String, required: true },
    purpose: { type: String, enum: ["customer-auth"], required: true },
    attempts: { type: Number, default: 0, min: 0, max: 5 },
    expiresAt: { type: Date, required: true },
    consumedAt: { type: Date, default: null },
    requestIp: { type: String, required: true, maxlength: 128 }
  },
  { timestamps: true }
);

emailOtpVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
emailOtpVerificationSchema.index({ normalizedEmail: 1, purpose: 1, createdAt: -1 });
emailOtpVerificationSchema.index({ requestIp: 1, purpose: 1, createdAt: -1 });
emailOtpVerificationSchema.index(
  { normalizedEmail: 1, purpose: 1 },
  {
    unique: true,
    partialFilterExpression: { consumedAt: null }
  }
);

export const EmailOtpVerification =
  (mongoose.models.EmailOtpVerification as Model<EmailOtpVerificationRecord> | undefined) ??
  mongoose.model<EmailOtpVerificationRecord>(
    "EmailOtpVerification",
    emailOtpVerificationSchema
  );
