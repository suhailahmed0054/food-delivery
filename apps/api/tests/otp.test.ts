import assert from "node:assert/strict";
import test, { after } from "node:test";
import { generateOtp, hashOtp } from "../src/utils/otp";

const originalAuthSecret = process.env.AUTH_SECRET;
const originalOtpHashSecret = process.env.OTP_HASH_SECRET;
process.env.AUTH_SECRET = "auth-test-secret-with-at-least-32-characters";
process.env.OTP_HASH_SECRET = "otp-test-secret-with-at-least-32-characters";

after(() => {
  if (originalAuthSecret === undefined) {
    delete process.env.AUTH_SECRET;
  } else {
    process.env.AUTH_SECRET = originalAuthSecret;
  }
  if (originalOtpHashSecret === undefined) {
    delete process.env.OTP_HASH_SECRET;
  } else {
    process.env.OTP_HASH_SECRET = originalOtpHashSecret;
  }
});

test("generateOtp returns exactly six numeric digits in the required range", () => {
  for (let index = 0; index < 1_000; index += 1) {
    const otp = generateOtp();

    assert.match(otp, /^\d{6}$/);
    assert.equal(otp.length, 6);
    assert.ok(Number(otp) >= 100000);
    assert.ok(Number(otp) <= 999999);
  }
});

test("hashOtp is deterministic for the same normalized email and OTP", () => {
  const first = hashOtp("customer@example.com", "123456");
  const second = hashOtp("customer@example.com", "123456");

  assert.equal(first, second);
  assert.match(first, /^[a-f0-9]{64}$/);
});

test("hashOtp normalizes email capitalization and surrounding spaces", () => {
  const normalized = hashOtp("customer@example.com", "123456");
  const varied = hashOtp("  Customer@Example.COM  ", "123456");

  assert.equal(varied, normalized);
});

test("hashOtp produces different hashes for different OTP values", () => {
  const first = hashOtp("customer@example.com", "123456");
  const second = hashOtp("customer@example.com", "654321");

  assert.notEqual(first, second);
});

test("hashOtp produces different hashes for different emails", () => {
  const first = hashOtp("first@example.com", "123456");
  const second = hashOtp("second@example.com", "123456");

  assert.notEqual(first, second);
});

test("hashOtp throws when OTP_HASH_SECRET is missing", () => {
  const configuredAuthSecret = process.env.AUTH_SECRET;
  const configuredSecret = process.env.OTP_HASH_SECRET;
  delete process.env.OTP_HASH_SECRET;

  try {
    assert.throws(
      () => hashOtp("customer@example.com", "123456"),
      /OTP_HASH_SECRET is missing/
    );
  } finally {
    process.env.AUTH_SECRET = configuredAuthSecret;
    if (configuredSecret === undefined) {
      delete process.env.OTP_HASH_SECRET;
    } else {
      process.env.OTP_HASH_SECRET = configuredSecret;
    }
  }
});
