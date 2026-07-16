import mongoose from "mongoose";
import { connectDatabase, isDatabaseConnected } from "../config/db";
import { env } from "../config/env";
import {
  connectRedis,
  disconnectRedis,
  isRedisConnected
} from "../services/redisService";

async function verifyRazorpayCredentials() {
  if (!env.razorpayKeyId.startsWith("rzp_live_")) {
    throw new Error("RAZORPAY_KEY_ID must be a live key before public launch");
  }

  const authorization = Buffer.from(
    `${env.razorpayKeyId}:${env.razorpayKeySecret}`
  ).toString("base64");
  const response = await fetch("https://api.razorpay.com/v1/orders?count=1", {
    headers: { Authorization: `Basic ${authorization}` },
    signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) {
    throw new Error(`Razorpay credential check failed with status ${response.status}`);
  }
}

async function main() {
  if (!env.isProduction) {
    throw new Error("Run this command with NODE_ENV=production");
  }

  await Promise.all([connectDatabase(), connectRedis()]);
  if (!isDatabaseConnected()) throw new Error("MongoDB readiness check failed");
  if (!isRedisConnected()) throw new Error("Redis readiness check failed");
  await verifyRazorpayCredentials();

  console.log("Production dependencies verified: MongoDB, Redis, and Razorpay live mode.");
}

void main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown verification error";
    console.error(`Production verification failed: ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.allSettled([disconnectRedis(), mongoose.disconnect()]);
  });
