import { configureMongoDns } from "./mongoDns";
import mongoose from "mongoose";
import { env } from "./env";

type MongoServerDescription = {
  error?: { message?: unknown; code?: unknown } | null;
};

function mongoConnectionMessages(error: unknown) {
  const messages: string[] = [];
  if (error instanceof Error) messages.push(error.message);

  const reason = (error as {
    reason?: { servers?: Map<unknown, MongoServerDescription> };
  } | null)?.reason;
  if (reason?.servers instanceof Map) {
    for (const description of reason.servers.values()) {
      const message = description.error?.message;
      const code = description.error?.code;
      if (typeof message === "string") messages.push(message);
      if (typeof code === "string" || typeof code === "number") {
        messages.push(String(code));
      }
    }
  }

  return messages.join(" ").toLowerCase();
}

function mongoConnectionHint(error: unknown) {
  const details = mongoConnectionMessages(error);

  if (/authentication failed|bad auth|auth failed|usernotfound|code 18/.test(details)) {
    return "Atlas authentication failed. Verify the database user, URL-encoded password, and that the user belongs to the same Atlas project as the cluster.";
  }
  if (/querysrv|enotfound|eai_again|dns|eservfail|etimeout/.test(details)) {
    return "MongoDB SRV/DNS lookup failed. Verify the cluster hostname copied from Atlas; configure MONGODB_DNS_SERVERS only if the hosting resolver cannot resolve it.";
  }
  if (/certificate|tls|ssl|alert handshake/.test(details)) {
    return "The TLS connection to Atlas failed. Verify the Atlas URI and hosting runtime clock/TLS support.";
  }
  if (/not authorized|unauthorized|code 13/.test(details)) {
    return "The database user connected but lacks permission. Grant least-privilege readWrite access to the configured database.";
  }
  if (/could not connect|server selection|timed out|econnrefused|econnreset/.test(details)) {
    return "Atlas network selection timed out. Confirm the Render outbound CIDR ranges are active in the same Atlas project as the cluster referenced by MONGODB_URI, and confirm the cluster is available.";
  }

  return "Verify that MONGODB_URI, the Atlas cluster, database user, and project Network Access list all belong to the same Atlas project.";
}

export async function quarantineLegacySimulatedRefunds() {
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
    if (env.isProduction) {
      throw new Error("MongoDB connection failed: MONGODB_URI is not configured");
    }
    console.warn("MONGODB_URI is not set. API will run with local demo data.");
    return false;
  }

  try {
    configureMongoDns();
    await mongoose.connect(env.mongoUri, {
      dbName: env.mongoDatabaseName,
      serverSelectionTimeoutMS: 10_000
    });
    console.log("MongoDB connected");
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown connection error";
    const hint = mongoConnectionHint(error);
    if (env.isProduction) {
      throw new Error(`MongoDB connection failed: ${message} Diagnostic: ${hint}`);
    }
    console.warn(`MongoDB connection failed. API will use local demo data. ${message} Diagnostic: ${hint}`);
    return false;
  }
}
