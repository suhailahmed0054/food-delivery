import { Router } from "express";
import bcrypt from "bcryptjs";
import { createHash, timingSafeEqual } from "crypto";
import { User } from "../models/User";
import { env } from "../config/env";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken
} from "../services/tokenService";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth, requireCustomerAuth } from "../middleware/auth";
import {
  accountRateLimitKey,
  emailRateLimitKey,
  rateLimit
} from "../middleware/rateLimit";
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
  updateLocalAccount
} from "../services/localAccountStore";
import {
  EmailOtpCooldownError,
  EmailOtpStorageUnavailableError,
  issueEmailOtp,
  verifyEmailOtp
} from "../services/emailOtpService";
import { z } from "zod";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(72)
});

const adminRegistrationSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(320).transform((value) => value.toLowerCase()),
  password: z.string().min(12).max(72),
  confirmPassword: z.string().min(1).max(72),
  signupCode: z.string().trim().min(1).max(256)
}).refine((value) => value.password === value.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"]
});

const emailOtpRequestSchema = z.object({
  email: z.string().trim().email().max(320).transform((value) => value.toLowerCase())
});

const emailOtpVerifySchema = emailOtpRequestSchema.extend({
  otp: z.string().trim().regex(/^\d{6}$/)
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

function safeSecretMatch(first: string, second: string) {
  const firstHash = createHash("sha256").update(first).digest();
  const secondHash = createHash("sha256").update(second).digest();
  return timingSafeEqual(firstHash, secondHash);
}

function isLoopbackAddress(address: string | undefined) {
  return address === "127.0.0.1" ||
    address === "::1" ||
    address === "::ffff:127.0.0.1";
}

function createCustomerTokens(user: { id: string; role: "customer" }) {
  return {
    accessToken: signAccessToken(user),
    refreshToken: signRefreshToken(user)
  };
}

async function revokeRefreshSession(refreshToken: string | null) {
  if (!refreshToken) return;

  try {
    const payload = verifyRefreshToken(refreshToken);
    if (databaseUnavailable()) {
      if (process.env.NODE_ENV !== "production" && payload.role === "customer") {
        await updateLocalAccount(payload.sub, { refreshTokenHash: undefined });
      }
      return;
    }
    await User.findByIdAndUpdate(payload.sub, { $unset: { refreshTokenHash: 1 } });
  } catch {
    // Invalid or expired cookies are still cleared by the caller.
  }
}

authRouter.post(
  ["/send-otp", "/email/request-otp"],
  rateLimit(5, 15 * 60_000, "customer-otp-request-ip"),
  rateLimit(5, 15 * 60_000, "customer-otp-request-email", emailRateLimitKey),
  asyncHandler(async (req, res) => {
    const parsed = emailOtpRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Enter a valid email address." });
    }

    try {
      const result = await issueEmailOtp({
        email: parsed.data.email,
        requestIp: req.ip ?? "unknown"
      });
      return res.json({
        message: "If the address can receive email, a code has been sent.",
        resendAfterSeconds: result.resendAfterSeconds
      });
    } catch (error) {
      if (error instanceof EmailOtpCooldownError) {
        res.setHeader("Retry-After", String(error.retryAfterSeconds));
        return res.status(429).json({
          message: "Please wait before requesting another code.",
          retryAfterSeconds: error.retryAfterSeconds
        });
      }
      const deliveryError = error instanceof Error
        ? error.message
        : "Unknown email delivery error";
      console.error(`Customer OTP email delivery failed: ${deliveryError}`);
      return res.status(503).json({
        message: "We couldn't send the code. Please try again."
      });
    }
  })
);

authRouter.post(
  ["/verify-otp", "/email/verify-otp"],
  rateLimit(20, 15 * 60_000, "customer-otp-verify-ip"),
  rateLimit(20, 15 * 60_000, "customer-otp-verify-email", emailRateLimitKey),
  asyncHandler(async (req, res) => {
    const parsed = emailOtpVerifySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "The code is incorrect or expired." });
    }

    let verification: Awaited<ReturnType<typeof verifyEmailOtp>>;
    try {
      verification = await verifyEmailOtp(parsed.data);
    } catch (error) {
      if (error instanceof EmailOtpStorageUnavailableError) {
        return res.status(503).json({ message: "Verification is temporarily unavailable." });
      }
      throw error;
    }
    if (verification.status === "too_many_attempts") {
      return res.status(429).json({ message: "Too many attempts. Request a new code." });
    }
    if (verification.status === "expired") {
      return res.status(400).json({ message: "The code has expired. Request a new code." });
    }
    if (verification.status !== "verified") {
      return res.status(400).json({ message: "The code is incorrect or expired." });
    }

    if (databaseUnavailable()) {
      if (process.env.NODE_ENV === "production") {
        return res.status(503).json({ message: "Account service is unavailable" });
      }

      let user = await findLocalAccountByEmail(verification.normalizedEmail);
      if (!user) {
        user = await createLocalAccount({
          name: "Customer",
          email: verification.normalizedEmail,
          emailVerified: true
        });
      }
      if (!user || user.role !== "customer" || user.isBlocked) {
        return res.status(401).json({ message: "Account is unavailable" });
      }

      const tokens = createCustomerTokens({ id: user.id, role: "customer" });
      await updateLocalAccount(user.id, {
        emailVerified: true,
        refreshTokenHash: hashToken(tokens.refreshToken)
      });
      setCustomerAuthCookies(res, tokens.accessToken, tokens.refreshToken);
      return res.json({ user: publicUser(user) });
    }

    let user = await User.findOne({ email: verification.normalizedEmail });
    if (!user) {
      try {
        user = await User.create({
          name: "Customer",
          email: verification.normalizedEmail,
          emailVerified: true,
          role: "customer"
        });
      } catch (error) {
        if ((error as { code?: number }).code !== 11000) throw error;
        user = await User.findOne({ email: verification.normalizedEmail });
      }
    }
    if (!user || user.role !== "customer" || user.isBlocked) {
      return res.status(401).json({ message: "Account is unavailable" });
    }

    const tokens = createCustomerTokens({ id: user.id, role: "customer" });
    user.emailVerified = true;
    user.refreshTokenHash = hashToken(tokens.refreshToken);
    await user.save();
    setCustomerAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    return res.json({ user: publicUser(user) });
  })
);

authRouter.post(
  "/admin/register",
  rateLimit(3, 60 * 60_000, "admin-register", accountRateLimitKey),
  asyncHandler(async (req, res) => {
    const parsed = adminRegistrationSchema.safeParse(req.body);
    if (!parsed.success) {
      const passwordMismatch = parsed.error.issues.some(
        (issue) => issue.path[0] === "confirmPassword"
      );
      return res.status(400).json({
        message: passwordMismatch
          ? "Passwords do not match"
          : "Enter valid administrator profile details"
      });
    }
    if (!env.adminSignupCode) {
      return res.status(503).json({
        message: "Administrator profile setup is not configured"
      });
    }
    if (databaseUnavailable()) {
      return res.status(503).json({
        message: "Administrator profile setup is temporarily unavailable"
      });
    }
    if (!safeSecretMatch(parsed.data.signupCode, env.adminSignupCode)) {
      return res.status(403).json({ message: "Unable to create administrator profile" });
    }

    const [existingAdmin, existingEmail] = await Promise.all([
      User.exists({ role: "admin" }),
      User.exists({ email: parsed.data.email })
    ]);
    if (existingAdmin) {
      return res.status(409).json({
        message: "Administrator profile setup has already been completed"
      });
    }
    if (existingEmail) {
      return res.status(409).json({ message: "Unable to create administrator profile" });
    }

    try {
      const passwordHash = await bcrypt.hash(parsed.data.password, 12);
      const user = new User({
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash,
        role: "admin",
        emailVerified: true,
        isBlocked: false,
        isPrimaryAdmin: true,
        lastLoginAt: new Date()
      });
      const tokens = createAdminTokens({ id: user.id, role: "admin" });
      user.refreshTokenHash = hashToken(tokens.refreshToken);
      await user.save();
      setAdminAuthCookies(res, tokens.accessToken, tokens.refreshToken);
      return res.status(201).json({ user: publicUser(user) });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        return res.status(409).json({
          message: "Administrator profile setup has already been completed"
        });
      }
      throw error;
    }
  })
);

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
      if (env.usesDemoAdminCredentials && !isLoopbackAddress(req.ip)) {
        return res.status(403).json({
          message: "Local demo admin access is only available from this computer"
        });
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

    const user = await User.findOne({ email: parsed.data.email })
      .select("+passwordHash");
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
    user.lastLoginAt = new Date();
    await user.save();
    setAdminAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    return res.json({ user: publicUser(user) });
  })
);

const sendCurrentUser = asyncHandler(async (req, res) => {
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
  });

authRouter.get("/session", requireCustomerAuth, sendCurrentUser);
authRouter.get("/me", requireAuth, sendCurrentUser);

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
    await revokeRefreshSession(refreshToken);
    clearCustomerAuthCookies(res);
    return res.status(204).send();
  })
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    await Promise.all([
      revokeRefreshSession(readCookie(req, customerRefreshCookieName)),
      revokeRefreshSession(readCookie(req, adminRefreshCookieName))
    ]);
    clearCustomerAuthCookies(res);
    clearAdminAuthCookies(res);
    return res.status(204).send();
  })
);
