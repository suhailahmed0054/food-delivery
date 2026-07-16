import mongoose from "mongoose";
import { env } from "./env";

async function quarantineLegacySimulatedRefunds() {
  const database = mongoose.connection.db;
  if (!database) return;

  await database.collection("orders").updateMany(
    { refundStatus: "simulated" },
    {
      $set: {
        refundStatus: "failed",
        paymentStatus: "paid",
        refundError: "Legacy simulated refund requires manual reconciliation"
      }
    }
  );
  await database.collection("issues").updateMany(
    { refundStatus: { $in: ["simulated", "refunded"] } },
    {
      $set: {
        refundStatus: "failed",
        status: "investigating",
        chatStatus: "active"
      },
      $unset: { closedAt: "" }
    }
  );
}

export function isDatabaseConnected() {
  return mongoose.connection.readyState === 1;
}

export async function connectDatabase() {
  if (!env.mongoUri) {
    console.warn("MONGODB_URI is not set. API will run with local demo data.");
    return false;
  }

  try {
    await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 10_000 });
    await quarantineLegacySimulatedRefunds();
    console.log("MongoDB connected");
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown connection error";
    if (env.isProduction) throw new Error(`MongoDB connection failed: ${message}`);
    console.warn(`MongoDB connection failed. API will use local demo data. ${message}`);
    return false;
  }
}
