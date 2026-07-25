import "../config/mongoDns";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { env } from "../config/env";
import { User } from "../models/User";

async function createAdmin() {
  if (!env.mongoUri) {
    throw new Error("MONGODB_URI is required to create a production admin");
  }
  if (!env.adminEmail || !env.adminPassword || env.adminPassword.length < 12) {
    throw new Error(
      "ADMIN_EMAIL and an ADMIN_PASSWORD of at least 12 characters are required"
    );
  }

  await mongoose.connect(env.mongoUri, { dbName: env.mongoDatabaseName });
  const passwordHash = await bcrypt.hash(env.adminPassword, 12);
  const admin = await User.findOneAndUpdate(
    { email: env.adminEmail.toLowerCase() },
    {
      name: "Al-Arab Administrator",
      email: env.adminEmail.toLowerCase(),
      passwordHash,
      role: "admin",
      isBlocked: false,
      $unset: { blockedAt: 1, blockReason: 1 }
    },
    { new: true, upsert: true, runValidators: true }
  );

  console.log(`Admin account ready: ${admin.email}`);
  await mongoose.disconnect();
}

createAdmin().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
