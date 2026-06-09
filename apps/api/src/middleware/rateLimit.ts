import { NextFunction, Request, Response } from "express";

const hits = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(maxRequests = 120, windowMs = 60_000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip ?? "unknown";
    const now = Date.now();
    const current = hits.get(key);

    if (!current || current.resetAt < now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (current.count >= maxRequests) {
      return res.status(429).json({ message: "Too many requests. Please try again shortly." });
    }

    current.count += 1;
    return next();
  };
}
