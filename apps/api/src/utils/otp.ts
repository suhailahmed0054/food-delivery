import { createHmac, randomInt } from "node:crypto";

export function generateOtp(): string {
  return randomInt(100000, 1000000).toString();
}

export function hashOtp(email: string, otp: string): string {
  const secret = process.env.OTP_HASH_SECRET?.trim();

  if (!secret) {
    throw new Error("OTP_HASH_SECRET is missing");
  }

  return createHmac("sha256", secret)
    .update(`email-otp:${email.trim().toLowerCase()}:${otp}`)
    .digest("hex");
}
