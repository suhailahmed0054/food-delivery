import { randomInt, timingSafeEqual } from "node:crypto";
import {
  EmailOtpVerification,
  type EmailOtpPurpose
} from "../models/EmailOtpVerification";
import { generateOtp, hashOtp } from "../utils/otp";
import { sendCustomerVerificationCode } from "./emailService";

export const emailOtpExpiresMs = 5 * 60_000;
export const emailOtpResendCooldownMs = 60_000;
export const emailOtpMaximumAttempts = 5;

type MemoryOtpRecord = {
  id: string;
  normalizedEmail: string;
  otpHash: string;
  purpose: EmailOtpPurpose;
  attempts: number;
  expiresAt: Date;
  consumedAt: Date | null;
  requestIp: string;
  createdAt: Date;
};

type IssueEmailOtpOptions = {
  now?: Date;
  codeOverride?: string;
  deliver?: (email: string, otp: string) => Promise<void>;
  forceMemory?: boolean;
};

type VerifyEmailOtpOptions = {
  now?: Date;
  forceMemory?: boolean;
};

export type EmailOtpVerificationResult =
  | { status: "verified"; normalizedEmail: string }
  | { status: "expired" }
  | { status: "incorrect_or_expired" }
  | { status: "too_many_attempts" };

export class EmailOtpCooldownError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super("Please wait before requesting another code");
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class EmailOtpStorageUnavailableError extends Error {
  constructor() {
    super("OTP storage is unavailable");
  }
}

const memoryOtpRecords = new Map<string, MemoryOtpRecord>();

export function normalizeEmailAddress(email: string) {
  return email.trim().toLowerCase();
}

function challengeKey(email: string, purpose: EmailOtpPurpose) {
  return `${purpose}:${email}`;
}

function hashesMatch(first: string, second: string) {
  const firstBuffer = Buffer.from(first, "hex");
  const secondBuffer = Buffer.from(second, "hex");
  return (
    firstBuffer.length === secondBuffer.length &&
    timingSafeEqual(firstBuffer, secondBuffer)
  );
}

function shouldUseMemoryStore(forceMemory = false) {
  if (forceMemory) return true;
  if (EmailOtpVerification.db.readyState === 1) return false;
  if (process.env.NODE_ENV === "production") {
    throw new EmailOtpStorageUnavailableError();
  }
  return true;
}

export async function issueEmailOtp(
  input: { email: string; requestIp: string; purpose?: EmailOtpPurpose },
  options: IssueEmailOtpOptions = {}
) {
  const normalizedEmail = normalizeEmailAddress(input.email);
  const purpose = input.purpose ?? "customer-auth";
  const now = options.now ?? new Date();
  const otp = options.codeOverride ?? generateOtp();
  if (!/^\d{6}$/.test(otp)) throw new Error("OTP must contain six digits");
  const useMemory = shouldUseMemoryStore(options.forceMemory);

  const expiresAt = new Date(now.getTime() + emailOtpExpiresMs);
  const otpHash = hashOtp(normalizedEmail, otp);
  let recordId: string;

  if (useMemory) {
    const key = challengeKey(normalizedEmail, purpose);
    const current = memoryOtpRecords.get(key);
    if (current && !current.consumedAt) {
      const elapsedMs = now.getTime() - current.createdAt.getTime();
      if (elapsedMs < emailOtpResendCooldownMs) {
        throw new EmailOtpCooldownError(
          Math.max(1, Math.ceil((emailOtpResendCooldownMs - elapsedMs) / 1000))
        );
      }
      current.consumedAt = now;
    }

    recordId = `${now.getTime()}-${randomInt(0, 1_000_000)}`;
    memoryOtpRecords.set(key, {
      id: recordId,
      normalizedEmail,
      otpHash,
      purpose,
      attempts: 0,
      expiresAt,
      consumedAt: null,
      requestIp: input.requestIp,
      createdAt: now
    });
  } else {
    const current = await EmailOtpVerification.findOne({
      normalizedEmail,
      purpose,
      consumedAt: null
    }).sort({ createdAt: -1 });
    if (current) {
      const elapsedMs = now.getTime() - current.createdAt.getTime();
      if (elapsedMs < emailOtpResendCooldownMs) {
        throw new EmailOtpCooldownError(
          Math.max(1, Math.ceil((emailOtpResendCooldownMs - elapsedMs) / 1000))
        );
      }
    }

    await EmailOtpVerification.updateMany(
      { normalizedEmail, purpose, consumedAt: null },
      { $set: { consumedAt: now } }
    );
    const record = await EmailOtpVerification.create({
      normalizedEmail,
      otpHash,
      purpose,
      attempts: 0,
      expiresAt,
      consumedAt: null,
      requestIp: input.requestIp
    });
    recordId = String(record._id);
  }

  try {
    await (options.deliver ?? sendCustomerVerificationCode)(normalizedEmail, otp);
  } catch (error) {
    if (useMemory) {
      const record = memoryOtpRecords.get(challengeKey(normalizedEmail, purpose));
      if (record?.id === recordId) record.consumedAt = now;
    } else {
      await EmailOtpVerification.updateOne(
        { _id: recordId, consumedAt: null },
        { $set: { consumedAt: now } }
      );
    }
    throw error;
  }

  return { normalizedEmail, resendAfterSeconds: 60 };
}

export async function verifyEmailOtp(
  input: { email: string; otp: string; purpose?: EmailOtpPurpose },
  options: VerifyEmailOtpOptions = {}
): Promise<EmailOtpVerificationResult> {
  const normalizedEmail = normalizeEmailAddress(input.email);
  const purpose = input.purpose ?? "customer-auth";
  const now = options.now ?? new Date();
  const suppliedHash = hashOtp(normalizedEmail, input.otp);
  const useMemory = shouldUseMemoryStore(options.forceMemory);

  if (useMemory) {
    const record = memoryOtpRecords.get(challengeKey(normalizedEmail, purpose));
    if (!record || record.consumedAt) {
      return { status: "incorrect_or_expired" };
    }
    if (record.expiresAt.getTime() <= now.getTime()) {
      record.consumedAt = now;
      return { status: "expired" };
    }
    if (record.attempts >= emailOtpMaximumAttempts) {
      return { status: "too_many_attempts" };
    }
    if (!hashesMatch(record.otpHash, suppliedHash)) {
      record.attempts += 1;
      if (record.attempts >= emailOtpMaximumAttempts) {
        record.consumedAt = now;
        return { status: "too_many_attempts" };
      }
      return { status: "incorrect_or_expired" };
    }

    record.consumedAt = now;
    return { status: "verified", normalizedEmail };
  }

  const record = await EmailOtpVerification.findOne({
    normalizedEmail,
    purpose,
    consumedAt: null
  }).sort({ createdAt: -1 });
  if (!record) {
    return { status: "incorrect_or_expired" };
  }
  if (record.expiresAt.getTime() <= now.getTime()) {
    record.consumedAt = now;
    await record.save();
    return { status: "expired" };
  }
  if (record.attempts >= emailOtpMaximumAttempts) {
    return { status: "too_many_attempts" };
  }

  if (!hashesMatch(record.otpHash, suppliedHash)) {
    const updated = await EmailOtpVerification.findOneAndUpdate(
      {
        _id: record._id,
        consumedAt: null,
        expiresAt: { $gt: now },
        attempts: { $lt: emailOtpMaximumAttempts }
      },
      { $inc: { attempts: 1 } },
      { new: true }
    );
    if (!updated || updated.attempts >= emailOtpMaximumAttempts) {
      if (updated) {
        updated.consumedAt = now;
        await updated.save();
      }
      return { status: "too_many_attempts" };
    }
    return { status: "incorrect_or_expired" };
  }

  const consumed = await EmailOtpVerification.findOneAndUpdate(
    {
      _id: record._id,
      otpHash: record.otpHash,
      consumedAt: null,
      expiresAt: { $gt: now },
      attempts: { $lt: emailOtpMaximumAttempts }
    },
    { $set: { consumedAt: now } },
    { new: true }
  );
  if (!consumed) return { status: "incorrect_or_expired" };
  return { status: "verified", normalizedEmail };
}

export function resetMemoryEmailOtpStoreForTests() {
  memoryOtpRecords.clear();
}
