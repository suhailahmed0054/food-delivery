import "../config/mongoDns";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { env } from "../config/env";
import { User } from "../models/User";

const adminEmailPattern = /^\S+@\S+\.\S+$/;

async function createAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "";
  const adminPassword = process.env.ADMIN_PASSWORD?.trim() ?? "";

  if (!env.mongoUri) {
    throw new Error("MONGODB_URI is required to create a production admin");
  }
  if (!adminEmail || !adminEmailPattern.test(adminEmail)) {
    throw new Error(
      "Add a valid ADMIN_EMAIL to apps/api/.env before running create-admin"
    );
  }
  if (!adminPassword || adminPassword.length < 12) {
    throw new Error(
      "Add an ADMIN_PASSWORD of at least 12 characters to apps/api/.env before running create-admin"
    );
  }

  await mongoose.connect(env.mongoUri, { dbName: env.mongoDatabaseName });
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const admin = await User.findOneAndUpdate(
    { email: adminEmail },
    {
      $set: {
        name: "Al-Arab Administrator",
        email: adminEmail,
        passwordHash,
        role: "admin",
        isBlocked: false,
        emailVerified: true
      },
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
