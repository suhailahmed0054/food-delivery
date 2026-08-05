import { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../services/tokenService";
import { User, type UserRole } from "../models/User";
import { adminAccessCookieName, readCookie } from "../services/authCookieService";
import { customerAccessCookieName } from "../services/authCookieService";
import { findLocalAccountById } from "../services/localAccountStore";
import { env } from "../config/env";

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: UserRole };
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token =
    readCookie(req, adminAccessCookieName) ??
    req.headers.authorization?.replace("Bearer ", "") ??
    readCookie(req, customerAccessCookieName);
  if (!token) return res.status(401).json({ message: "Missing access token" });

  void (async () => {
    try {
      const payload = verifyAccessToken(token);
      const account = isAllowedLocalDemoAdmin(req, payload)
        ? { id: "local-admin", role: "admin" as const, isBlocked: false }
        : User.db.readyState === 1
        ? await User.findOne({
            _id: payload.sub,
            role: payload.role,
            isBlocked: false
          }).select("_id role").lean()
        : process.env.NODE_ENV === "production"
          ? null
          : await findLocalAccountById(payload.sub);
      if (
        !account ||
        ("isBlocked" in account && account.isBlocked) ||
        ("role" in account && account.role !== payload.role)
      ) {
        return res.status(403).json({ message: "Account is unavailable" });
      }
      req.user = { id: payload.sub, role: payload.role };
      return next();
    } catch {
      return res.status(401).json({ message: "Invalid or expired token" });
    }
  })();
}

function isLoopbackAddress(address: string | undefined) {
  return address === "127.0.0.1" ||
    address === "::1" ||
    address === "::ffff:127.0.0.1";
}

function isAllowedLocalDemoAdmin(
  req: Request,
  payload: { sub: string; role: UserRole }
) {
  return !env.isProduction &&
    User.db.readyState !== 1 &&
    env.usesDemoAdminCredentials &&
    payload.sub === "local-admin" &&
    payload.role === "admin" &&
    isLoopbackAddress(req.ip);
}

export function requireCustomerAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const token =
    readCookie(req, customerAccessCookieName) ??
    req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ message: "Please sign in to continue" });

  void (async () => {
    try {
      const payload = verifyAccessToken(token);
      if (payload.role !== "customer") {
        return res.status(403).json({ message: "Customer account required" });
      }
      const account = User.db.readyState === 1
        ? await User.findOne({
            _id: payload.sub,
            role: "customer",
            isBlocked: false
          }).select("_id").lean()
        : process.env.NODE_ENV === "production"
          ? null
          : await findLocalAccountById(payload.sub);
      if (!account || ("isBlocked" in account && account.isBlocked)) {
        return res.status(403).json({ message: "Account is unavailable" });
      }
      req.user = { id: payload.sub, role: payload.role };
      return next();
    } catch {
      return res.status(401).json({ message: "Your session has expired" });
    }
  })();
}

export function optionalCustomerAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Try customer cookie/token first
  const customerToken =
    readCookie(req, customerAccessCookieName) ??
    req.headers.authorization?.replace("Bearer ", "");

  // Also try admin cookie so admin users hitting optional-auth routes are recognized
  const adminToken = readCookie(req, adminAccessCookieName);

  const token = customerToken || adminToken;
  if (!token) return next();

  void (async () => {
    try {
      const payload = verifyAccessToken(token);

      // Revalidate staff accounts so blocking or role changes revoke access
      // without waiting for the access token to expire.
      if (payload.role === "admin" || payload.role === "kitchen") {
        const account = isAllowedLocalDemoAdmin(req, payload)
          ? { id: "local-admin", role: "admin" as const, isBlocked: false }
          : User.db.readyState === 1
          ? await User.findOne({
              _id: payload.sub,
              role: payload.role,
              isBlocked: false
            }).select("_id").lean()
          : process.env.NODE_ENV === "production"
            ? null
            : await findLocalAccountById(payload.sub);
        if (!account || ("isBlocked" in account && account.isBlocked)) {
          return res.status(403).json({ message: "Account is unavailable" });
        }
        req.user = { id: payload.sub, role: payload.role };
        return next();
      }

      if (payload.role !== "customer") {
        return res.status(403).json({ message: "Customer account required" });
      }
      const account = User.db.readyState === 1
        ? await User.findOne({
            _id: payload.sub,
            role: "customer",
            isBlocked: false
          }).select("_id").lean()
        : process.env.NODE_ENV === "production"
          ? null
          : await findLocalAccountById(payload.sub);
      if (!account || ("isBlocked" in account && account.isBlocked)) {
        return res.status(403).json({ message: "Account is unavailable" });
      }
      req.user = { id: payload.sub, role: payload.role };
      return next();
    } catch {
      return res.status(401).json({ message: "Your session has expired" });
    }
  })();
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
}
