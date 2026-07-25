import { createHash } from "crypto";
import type { Request } from "express";
import {
  ipKeyGenerator,
  rateLimit as expressRateLimit,
  type Options
} from "express-rate-limit";
import { createRateLimitStore } from "../services/redisService";

type RateLimitKey = (req: Request) => string;

function normalizedIp(req: Request) {
  return ipKeyGenerator(req.ip ?? "unknown");
}

export function accountRateLimitKey(req: Request) {
  const email = typeof req.body?.email === "string"
    ? req.body.email.trim().toLowerCase()
    : "unknown";
  const accountHash = createHash("sha256").update(email).digest("hex").slice(0, 20);
  return `${normalizedIp(req)}:${accountHash}`;
}

export function emailRateLimitKey(req: Request) {
  const email = typeof req.body?.email === "string"
    ? req.body.email.trim().toLowerCase()
    : "unknown";
  return createHash("sha256").update(email).digest("hex").slice(0, 24);
}

export function rateLimit(
  maxRequests = 120,
  windowMs = 60_000,
  name = "global",
  keyGenerator: RateLimitKey = normalizedIp
) {
  const options: Partial<Options> = {
    windowMs,
    limit: maxRequests,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator,
    handler: (_req, res) => {
      res.status(429).json({ message: "Too many requests. Please try again shortly." });
    },
    passOnStoreError: false
  };
  const store = createRateLimitStore(`al-arab:${name}:`);
  if (store) options.store = store;
  return expressRateLimit(options);
}
