import { createClient, type RedisClientType } from "redis";
import { RedisStore } from "rate-limit-redis";
import { env } from "../config/env";

let redisClient: RedisClientType | null = null;

function getRedisClient() {
  if (!env.redisUrl) return null;
  if (!redisClient) {
    redisClient = createClient({ url: env.redisUrl });
    redisClient.on("error", (error) => {
      console.error("Redis error:", error instanceof Error ? error.message : error);
    });
  }
  return redisClient;
}

export function createRateLimitStore(prefix: string) {
  const client = getRedisClient();
  if (!client) return undefined;
  return new RedisStore({
    prefix,
    sendCommand: (...args: string[]) => client.sendCommand(args)
  });
}

export function isRedisConnected() {
  return Boolean(redisClient?.isReady);
}

export async function connectRedis() {
  const client = getRedisClient();
  if (!client) return false;
  try {
    if (!client.isOpen) await client.connect();
    return client.isReady;
  } catch (error) {
    if (client.isOpen) client.destroy();
    const message = error instanceof Error ? error.message : "Unknown Redis connection error";
    if (env.isProduction) throw new Error(`Redis connection failed: ${message}`);
    console.warn(`Redis unavailable. Development rate limits will use in-memory storage. ${message}`);
    redisClient = null;
    return false;
  }
}

export async function disconnectRedis() {
  if (!redisClient?.isOpen) return;
  await redisClient.quit();
  redisClient = null;
}
