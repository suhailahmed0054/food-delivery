import { createHash, createHmac } from "node:crypto";
import { z } from "zod";
import { env } from "../config/env";

export const orderIdempotencyKeySchema = z
  .string()
  .trim()
  .min(16)
  .max(128)
  .regex(
    /^[A-Za-z0-9._~-]+$/,
    "Idempotency-Key contains unsupported characters"
  );

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([first], [second]) => first.localeCompare(second))
      .map(([key, entry]) => [key, canonicalize(entry)])
  );
}

export function hashOrderIdempotencyKey(customerId: string, key: string) {
  return createHmac("sha256", env.authSecret)
    .update(`order-idempotency:${customerId}:${key}`)
    .digest("hex");
}

export function fingerprintOrderRequest(customerId: string, payload: unknown) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        customerId,
        payload: canonicalize(payload)
      })
    )
    .digest("hex");
}

export function createIdempotentOrderTrackingToken(
  customerId: string,
  key: string
) {
  return createHmac("sha256", env.authSecret)
    .update(`order-tracking:${customerId}:${key}`)
    .digest("base64url");
}

export class IdempotencyConflictError extends Error {
  constructor() {
    super("This checkout key was already used with different order details");
    this.name = "IdempotencyConflictError";
  }
}
