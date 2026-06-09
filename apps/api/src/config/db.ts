import mongoose from "mongoose";
import { env } from "./env";

export async function connectDatabase() {
  if (!env.mongoUri) {
    console.warn("MONGODB_URI is not set. API will run with demo responses.");
    return;
  }

  await mongoose.connect(env.mongoUri);
  console.log("MongoDB connected");
}
