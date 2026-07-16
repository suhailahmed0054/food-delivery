import { Router } from "express";
import bcrypt from "bcryptjs";
import { createHash, timingSafeEqual } from "crypto";
import { OAuth2Client } from "google-auth-library";
import { User } from "../models/User";
import { env } from "../config/env";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken
} from "../services/tokenService";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { accountRateLimitKey, rateLimit } from "../middleware/rateLimit";
import {
  adminRefreshCookieName,
  clearAdminAuthCookies,
  clearCustomerAuthCookies,
  customerRefreshCookieName,
  readCookie,
  setAdminAuthCookies,
  setCustomerAuthCookies
} from "../services/authCookieService";
import {
  createLocalAccount,
  findLocalAccountByEmail,
  findLocalAccountById,
  updateLocalAccount,
  upsertLocalGoogleAccount
} from "../services/localAccountStore";
import { z } from "zod";

export const authRouter = Router();

const registerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(72)
});

const loginSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(72)
});

const googleSchema = z.object({
  idToken: z.string().trim().min(1)
});

function databaseUnavailable() {
  return User.db.readyState !== 1;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function safeTextMatch(first: string, second: string) {
  const firstBuffer = Buffer.from(first);
  const secondBuffer = Buffer.from(second);
  return (
    firstBuffer.length === secondBuffer.length &&
    timingSafeEqual(firstBuffer, secondBuffer)
  );
}

function publicUser(user: {
  id?: string;
  _id?: unknown;
  name: string;
  email: string;
  role: "customer" | "admin" | "kitchen";
}) {
  return {
    id: user.id ?? String(user._id),
    name: user.name,
    email: user.email,
    role: user.role
  };
}

function createAdminTokens(user: { id: string; role: "admin" }) {
  return {
    accessToken: signAccessToken(user),
    refreshToken: signRefreshToken(user)
  };
}

function createCustomerTokens(user: { id: string; role: "customer" }) {
  return {
    accessToken: signAccessToken(user),
    refreshToken: signRefreshToken(user)
  };
}

authRouter.post("/register", rateLimit(5, 15 * 60_000, "register", accountRateLimitKey), asyncHandler(async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid registration details", errors: parsed.error.flatten() });
  }
  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  if (databaseUnavailable()) {
    if (process.env.NODE_ENV === "production") {
      return res.status(503).json({ message: "Account service is unavailable" });
    }
    const user = await createLocalAccount({
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash
    });
    if (!user) {
      return res.status(409).json({ message: "An account with this email already exists" });
    }
    const tokens = createCustomerTokens({ id: user.id, role: "customer" });
    await updateLocalAccount(user.id, {
      refreshTokenHash: hashToken(tokens.refreshToken)
    });
    setCustomerAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    return res.status(201).json({
      user: publicUser(user)
    });
  }

  const existingUser = await User.exists({ email: parsed.data.email });
  if (existingUser) return res.status(409).json({ message: "An account with this email already exists" });

  const user = await User.create({
    name: parsed.data.name,
    email: parsed.data.email,
    passwordHash,
    role: "customer"
  });
  const tokens = createCustomerTokens({ id: user.id, role: "customer" });
  user.refreshTokenHash = hashToken(tokens.refreshToken);
  await user.save();
  setCustomerAuthCookies(res, tokens.accessToken, tokens.refreshToken);
  return res.status(201).json({
    user: publicUser(user)
  });
}));

authRouter.post("/login", rateLimit(5, 15 * 60_000, "customer-login", accountRateLimitKey), asyncHandler(async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Enter a valid email and password" });
  if (databaseUnavailable()) {
    if (process.env.NODE_ENV === "production") {
      return res.status(503).json({ message: "Account service is unavailable" });
    }
    const user = await findLocalAccountByEmail(parsed.data.email);
    if (
      !user?.passwordHash ||
      user.role !== "customer" ||
      user.isBlocked ||
      !(await bcrypt.compare(parsed.data.password, user.passwordHash))
    ) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    const tokens = createCustomerTokens({ id: user.id, role: "customer" });
    await updateLocalAccount(user.id, {
      refreshTokenHash: hashToken(tokens.refreshToken)
    });
    setCustomerAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    return res.json({
      user: publicUser(user)
    });
  }

  const user = await User.findOne({ email: parsed.data.email });
  if (!user?.passwordHash || user.role !== "customer" || user.isBlocked) {
    return res.status(401).json({ message: "Invalid credentials" });
  }
  const matches = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!matches) return res.status(401).json({ message: "Invalid credentials" });
  const tokens = createCustomerTokens({ id: user.id, role: "customer" });
  user.refreshTokenHash = hashToken(tokens.refreshToken);
  await user.save();
  setCustomerAuthCookies(res, tokens.accessToken, tokens.refreshToken);
  return res.json({
    user: publicUser(user)
  });
}));

authRouter.post("/google", rateLimit(10, 15 * 60_000, "google-login"), asyncHandler(async (req, res) => {
  const parsed = googleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Google ID token is required" });
  if (!env.googleClientId) return res.status(503).json({ message: "Google sign-in is not configured" });
  const client = new OAuth2Client(env.googleClientId);
  const ticket = await client.verifyIdToken({ idToken: parsed.data.idToken, audience: env.googleClientId });
  const payload = ticket.getPayload();
  if (!payload?.email || payload.email_verified !== true) {
    return res.status(401).json({ message: "A verified Google account email is required" });
  }

  if (databaseUnavailable()) {
    if (process.env.NODE_ENV === "production") {
      return res.status(503).json({ message: "Account service is unavailable" });
    }
    const user = await upsertLocalGoogleAccount({
      name: payload.name ?? "Google User",
      email: payload.email,
      googleId: payload.sub
    });
    if (!user || user.isBlocked) {
      return res.status(401).json({ message: "Account is unavailable" });
    }
    const tokens = createCustomerTokens({ id: user.id, role: "customer" });
    await updateLocalAccount(user.id, {
      refreshTokenHash: hashToken(tokens.refreshToken)
    });
    setCustomerAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    return res.json({ user: publicUser(user) });
  }

  const user = await User.findOneAndUpdate(
    { email: payload.email },
    { name: payload.name ?? "Google User", email: payload.email, googleId: payload.sub },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  if (user.role !== "customer" || user.isBlocked) {
    return res.status(401).json({ message: "Account is unavailable" });
  }
  const tokens = createCustomerTokens({ id: user.id, role: "customer" });
  user.refreshTokenHash = hashToken(tokens.refreshToken);
  await user.save();
  setCustomerAuthCookies(res, tokens.accessToken, tokens.refreshToken);
  return res.json({ user: publicUser(user) });
}));

authRouter.post(
  "/admin/login",
  rateLimit(5, 15 * 60_000, "admin-login", accountRateLimitKey),
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (databaseUnavailable()) {
      if (process.env.NODE_ENV === "production") {
        return res.status(503).json({ message: "Admin account service is unavailable" });
      }

      const validEmail = safeTextMatch(
        parsed.data.email,
        env.adminEmail.toLowerCase()
      );
      const validPassword = safeTextMatch(parsed.data.password, env.adminPassword);
      if (!validEmail || !validPassword) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const user = {
        id: "local-admin",
        name: "Al-Arab Administrator",
        email: env.adminEmail,
        role: "admin" as const
      };
      const tokens = createAdminTokens({ id: user.id, role: user.role });
      setAdminAuthCookies(res, tokens.accessToken, tokens.refreshToken);
      return res.json({ user });
    }

    const user = await User.findOne({ email: parsed.data.email });
    if (
      !user?.passwordHash ||
      user.role !== "admin" ||
      user.isBlocked ||
      !(await bcrypt.compare(parsed.data.password, user.passwordHash))
    ) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const tokens = createAdminTokens({ id: user.id, role: "admin" });
    user.refreshTokenHash = hashToken(tokens.refreshToken);
    await user.save();
    setAdminAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    return res.json({ user: publicUser(user) });
  })
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });

    if (databaseUnavailable() && req.user.id === "local-admin") {
      return res.json({
        user: {
          id: "local-admin",
          name: "Al-Arab Administrator",
          email: env.adminEmail,
          role: "admin"
        }
      });
    }
    if (databaseUnavailable()) {
      const user = await findLocalAccountById(req.user.id);
      if (!user || user.isBlocked) {
        return res.status(401).json({ message: "Account is unavailable" });
      }
      return res.json({ user: publicUser(user) });
    }

    const user = await User.findById(req.user.id).lean();
    if (!user || user.isBlocked) {
      return res.status(401).json({ message: "Account is unavailable" });
    }
    return res.json({ user: publicUser({ ...user, id: String(user._id) }) });
  })
);

authRouter.post(
  "/refresh",
  rateLimit(30, 15 * 60_000, "token-refresh"),
  asyncHandler(async (req, res) => {
    const adminRefreshToken = readCookie(req, adminRefreshCookieName);
    const customerRefreshToken = readCookie(req, customerRefreshCookieName);
    const requestedRole =
      req.body?.role === "customer"
        ? "customer"
        : req.body?.role === "admin"
          ? "admin"
          : undefined;
    const refreshToken =
      requestedRole === "customer"
        ? customerRefreshToken
        : requestedRole === "admin"
          ? adminRefreshToken
          : adminRefreshToken ?? customerRefreshToken;
    if (!refreshToken) {
      if (requestedRole === "customer") clearCustomerAuthCookies(res);
      else if (requestedRole === "admin") clearAdminAuthCookies(res);
      else {
        clearAdminAuthCookies(res);
        clearCustomerAuthCookies(res);
      }
      return res.status(401).json({ message: "Session expired" });
    }

    try {
      const payload = verifyRefreshToken(refreshToken);
      if (payload.role === "customer") {
        const user = databaseUnavailable()
          ? await findLocalAccountById(payload.sub)
          : await User.findById(payload.sub);
        if (
          !user ||
          user.role !== "customer" ||
          user.isBlocked ||
          user.refreshTokenHash !== hashToken(refreshToken)
        ) {
          throw new Error("Invalid refresh token");
        }

        const tokens = createCustomerTokens({
          id: "id" in user ? user.id : String(user._id),
          role: "customer"
        });
        if ("_id" in user) {
          user.refreshTokenHash = hashToken(tokens.refreshToken);
          await user.save();
        } else {
          await updateLocalAccount(user.id, {
            refreshTokenHash: hashToken(tokens.refreshToken)
          });
        }
        setCustomerAuthCookies(res, tokens.accessToken, tokens.refreshToken);
        return res.json({ ok: true });
      }
      if (payload.role !== "admin") throw new Error("Invalid role");

      if (databaseUnavailable() && payload.sub === "local-admin") {
        const tokens = createAdminTokens({ id: "local-admin", role: "admin" });
        setAdminAuthCookies(res, tokens.accessToken, tokens.refreshToken);
        return res.json({ ok: true });
      }
      if (databaseUnavailable()) {
        throw new Error("Account service unavailable");
      }

      const user = await User.findById(payload.sub);
      if (
        !user ||
        user.role !== "admin" ||
        user.isBlocked ||
        user.refreshTokenHash !== hashToken(refreshToken)
      ) {
        throw new Error("Invalid refresh token");
      }

      const tokens = createAdminTokens({ id: user.id, role: "admin" });
      user.refreshTokenHash = hashToken(tokens.refreshToken);
      await user.save();
      setAdminAuthCookies(res, tokens.accessToken, tokens.refreshToken);
      return res.json({ ok: true });
    } catch {
      if (requestedRole === "customer") clearCustomerAuthCookies(res);
      else if (requestedRole === "admin") clearAdminAuthCookies(res);
      else {
        clearAdminAuthCookies(res);
        clearCustomerAuthCookies(res);
      }
      return res.status(401).json({ message: "Session expired" });
    }
  })
);

authRouter.post(
  "/customer/logout",
  asyncHandler(async (req, res) => {
    const refreshToken = readCookie(req, customerRefreshCookieName);
    if (refreshToken) {
      try {
        const payload = verifyRefreshToken(refreshToken);
        if (databaseUnavailable()) {
          await updateLocalAccount(payload.sub, { refreshTokenHash: undefined });
        } else {
          await User.findByIdAndUpdate(payload.sub, {
            $unset: { refreshTokenHash: 1 }
          });
        }
      } catch {
        // Invalid or expired cookies are still cleared.
      }
    }
    clearCustomerAuthCookies(res);
    return res.status(204).send();
  })
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const refreshToken = readCookie(req, adminRefreshCookieName);
    if (refreshToken && !databaseUnavailable()) {
      try {
        const payload = verifyRefreshToken(refreshToken);
        await User.findByIdAndUpdate(payload.sub, { $unset: { refreshTokenHash: 1 } });
      } catch {
        // Invalid or expired cookies are still cleared.
      }
    }
    clearAdminAuthCookies(res);
    return res.status(204).send();
  })
);
