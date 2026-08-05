import mongoose from "mongoose";
import {
  connectDatabase,
  isDatabaseConnected,
  quarantineLegacySimulatedRefunds
} from "../config/db";

async function migrateLegacyRefunds() {
  await connectDatabase();
  if (!isDatabaseConnected()) {
    throw new Error("MongoDB must be connected to migrate legacy refunds");
  }
  await quarantineLegacySimulatedRefunds();
  console.log("Legacy refund migration completed.");
}

void migrateLegacyRefunds()
  .catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : "Legacy refund migration failed"
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
