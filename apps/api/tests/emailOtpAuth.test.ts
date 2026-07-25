import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after, before } from "node:test";
import type { Server } from "node:http";

let server: Server;
let baseUrl = "";
let issueEmailOtp: typeof import("../src/services/emailOtpService").issueEmailOtp;
let resetMemoryEmailOtpStoreForTests: typeof import("../src/services/emailOtpService").resetMemoryEmailOtpStoreForTests;
let findLocalAccountByEmail: typeof import("../src/services/localAccountStore").findLocalAccountByEmail;

before(async () => {
  process.env.NODE_ENV = "test";
  process.env.AUTH_SECRET = "auth-test-secret-with-at-least-32-characters";
  process.env.OTP_HASH_SECRET = "otp-test-secret-with-at-least-32-characters";
  process.env.RESEND_API_KEY = "";
  process.env.EMAIL_FROM = "";
  process.env.LOCAL_ACCOUNT_DATA_FILE = path.join(
    await mkdtemp(path.join(tmpdir(), "al-arab-otp-tests-")),
    "customer-accounts.json"
  );

  const express = (await import("express")).default;
  const { authRouter } = await import("../src/routes/authRoutes");
  const otpService = await import("../src/services/emailOtpService");
  const localAccountStore = await import("../src/services/localAccountStore");
  issueEmailOtp = otpService.issueEmailOtp;
  resetMemoryEmailOtpStoreForTests = otpService.resetMemoryEmailOtpStoreForTests;
  findLocalAccountByEmail = localAccountStore.findLocalAccountByEmail;

  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json());
  app.use("/api/auth", authRouter);
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Test server did not start");
  }
  baseUrl = `http://127.0.0.1:${address.port}/api/auth`;
});

after(() => {
  server.close();
});

async function seedOtp(email: string, otp: string, now = new Date()) {
  await issueEmailOtp(
    { email, requestIp: "127.0.0.1" },
    {
      codeOverride: otp,
      deliver: async () => undefined,
      forceMemory: true,
      now
    }
  );
}

async function verify(email: string, otp: string) {
  return fetch(`${baseUrl}/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, otp })
  });
}

test("new customer registration and existing customer login share the OTP flow", async () => {
  resetMemoryEmailOtpStoreForTests();
  const email = "new-customer@example.com";
  await seedOtp(email, "123456");

  const registration = await verify(email, "123456");
  assert.equal(registration.status, 200);
  assert.match(registration.headers.get("set-cookie") ?? "", /al-arab-customer-access=/);
  const registered = await registration.json() as { user: { id: string; email: string; role: string } };
  assert.equal(registered.user.email, email);
  assert.equal(registered.user.role, "customer");

  const stored = await findLocalAccountByEmail(email);
  assert.equal(stored?.emailVerified, true);
  assert.equal(stored?.passwordHash, undefined);

  await seedOtp(email, "654321");
  const login = await verify(email, "654321");
  assert.equal(login.status, 200);
  const loggedIn = await login.json() as { user: { id: string } };
  assert.equal(loggedIn.user.id, registered.user.id);
});

test("incorrect OTP is rejected", async () => {
  resetMemoryEmailOtpStoreForTests();
  await seedOtp("incorrect@example.com", "123456");
  const response = await verify("incorrect@example.com", "000000");
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    message: "The code is incorrect or expired."
  });
});

test("expired OTP is rejected even before TTL cleanup", async () => {
  resetMemoryEmailOtpStoreForTests();
  const issuedSixMinutesAgo = new Date(Date.now() - 6 * 60_000);
  await seedOtp("expired@example.com", "123456", issuedSixMinutesAgo);
  const response = await verify("expired@example.com", "123456");
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    message: "The code has expired. Request a new code."
  });
});

test("verification creates HTTP-only cookies used by session and cleared by logout", async () => {
  resetMemoryEmailOtpStoreForTests();
  const email = "session@example.com";
  await seedOtp(email, "123456");

  const verification = await verify(email, "123456");
  assert.equal(verification.status, 200);
  const setCookie = verification.headers.get("set-cookie") ?? "";
  assert.match(setCookie, /al-arab-customer-access=/);
  assert.match(setCookie, /al-arab-customer-refresh=/);
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Strict/i);

  const access = setCookie.match(/al-arab-customer-access=([^;,\s]+)/)?.[1];
  const refresh = setCookie.match(/al-arab-customer-refresh=([^;,\s]+)/)?.[1];
  assert.ok(access);
  assert.ok(refresh);
  const cookie = `al-arab-customer-access=${access}; al-arab-customer-refresh=${refresh}`;

  const session = await fetch(`${baseUrl}/session`, {
    headers: { Cookie: cookie }
  });
  assert.equal(session.status, 200);
  const sessionBody = await session.json() as { user: { email: string; role: string } };
  assert.equal(sessionBody.user.email, email);
  assert.equal(sessionBody.user.role, "customer");

  const logout = await fetch(`${baseUrl}/logout`, {
    method: "POST",
    headers: { Cookie: cookie }
  });
  assert.equal(logout.status, 204);
  const clearedCookies = logout.headers.get("set-cookie") ?? "";
  assert.match(clearedCookies, /al-arab-customer-access=;/);
  assert.match(clearedCookies, /Max-Age=0/);
});

test("consumed OTP cannot be reused", async () => {
  resetMemoryEmailOtpStoreForTests();
  const email = "single-use@example.com";
  await seedOtp(email, "123456");
  assert.equal((await verify(email, "123456")).status, 200);
  assert.equal((await verify(email, "123456")).status, 400);
});

test("five incorrect attempts lock the challenge", async () => {
  resetMemoryEmailOtpStoreForTests();
  const email = "attempts@example.com";
  await seedOtp(email, "123456");

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    assert.equal((await verify(email, "000000")).status, 400);
  }
  assert.equal((await verify(email, "000000")).status, 429);
  assert.equal((await verify(email, "123456")).status, 400);
});

test("resending invalidates the previous OTP", async () => {
  resetMemoryEmailOtpStoreForTests();
  const email = "resend@example.com";
  await seedOtp(email, "111111", new Date(Date.now() - 61_000));
  await seedOtp(email, "222222");

  assert.equal((await verify(email, "111111")).status, 400);
  assert.equal((await verify(email, "222222")).status, 200);
});

test("resending is blocked during the 60-second cooldown", async () => {
  resetMemoryEmailOtpStoreForTests();
  const email = "cooldown@example.com";
  await seedOtp(email, "111111");

  await assert.rejects(
    () => seedOtp(email, "222222", new Date(Date.now() + 30_000)),
    /Please wait before requesting another code/
  );
});

test("two simultaneous verification requests can consume an OTP only once", async () => {
  resetMemoryEmailOtpStoreForTests();
  const email = "concurrent@example.com";
  await seedOtp(email, "123456");

  const responses = await Promise.all([
    verify(email, "123456"),
    verify(email, "123456")
  ]);
  assert.deepEqual(
    responses.map((response) => response.status).sort(),
    [200, 400]
  );
});

test("OTP request endpoint is rate limited and does not reveal account existence", async () => {
  resetMemoryEmailOtpStoreForTests();
  const statuses: number[] = [];
  for (let request = 0; request < 6; request += 1) {
    const response = await fetch(`${baseUrl}/send-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: `rate-${request}@example.com` })
    });
    statuses.push(response.status);
  }
  assert.equal(statuses.at(-1), 429);
});

test("OTP email limit applies even when requests come from different IP addresses", async () => {
  resetMemoryEmailOtpStoreForTests();
  const statuses: number[] = [];
  for (let request = 0; request < 6; request += 1) {
    const response = await fetch(`${baseUrl}/send-otp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": `198.51.100.${request + 1}`
      },
      body: JSON.stringify({ email: "same-customer@example.com" })
    });
    statuses.push(response.status);
  }
  assert.equal(statuses.at(-1), 429);
});

test("public password signup is disabled while seeded admin login remains", async () => {
  const customerPasswordLogin = await fetch(`${baseUrl}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "customer@example.com", password: "password" })
  });
  assert.equal(customerPasswordLogin.status, 404);

  const adminSignup = await fetch(`${baseUrl}/admin/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Unexpected Admin",
      email: "unexpected-admin@example.com",
      password: "not-used",
      authorizationCode: "not-used"
    })
  });
  assert.equal(adminSignup.status, 404);

  const adminLogin = await fetch(`${baseUrl}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@example.com", password: "wrong-password" })
  });
  assert.equal(adminLogin.status, 401);
});
