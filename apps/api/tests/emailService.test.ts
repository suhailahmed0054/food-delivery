import assert from "node:assert/strict";
import test from "node:test";

test("customer OTP email is sent through Resend with the required content", async () => {
  process.env.NODE_ENV = "test";
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.EMAIL_FROM = "Al-Arab Restaurant <login@example.com>";

  const originalFetch = globalThis.fetch;
  let requestUrl = "";
  let requestInit: RequestInit | undefined;
  globalThis.fetch = async (input, init) => {
    requestUrl = String(input);
    requestInit = init;
    return new Response(JSON.stringify({ id: "email_test" }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };

  try {
    const { sendCustomerVerificationCode } = await import("../src/services/emailService");
    await sendCustomerVerificationCode("customer@example.com", "123456");
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(requestUrl, "https://api.resend.com/emails");
  assert.equal(requestInit?.method, "POST");
  assert.equal(
    (requestInit?.headers as Record<string, string>).Authorization,
    "Bearer re_test_key"
  );

  const body = JSON.parse(String(requestInit?.body)) as {
    from: string;
    to: string[];
    subject: string;
    html: string;
    text: string;
  };
  assert.equal(body.from, "Al-Arab Restaurant <login@example.com>");
  assert.deepEqual(body.to, ["customer@example.com"]);
  assert.match(body.subject, /Al-Arab/i);
  assert.match(body.text, /123456/);
  assert.match(body.text, /5 minutes/i);
  assert.match(body.text, /do not share/i);
  assert.match(body.html, /123456/);
  assert.match(body.html, /Al-Arab Restaurant/i);
});
