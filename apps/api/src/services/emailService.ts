import { env } from "../config/env";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export function hasEmailDeliveryConfigured() {
  return Boolean(env.resendApiKey && env.emailFrom);
}

async function sendWithResend(message: EmailMessage) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.resendApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: env.emailFrom,
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text
    })
  });

  if (!response.ok) {
    const providerError = await response.json().catch(() => null) as {
      name?: unknown;
    } | null;
    const errorName = typeof providerError?.name === "string" &&
      /^[a-z0-9_-]{1,64}$/i.test(providerError.name)
      ? ` (${providerError.name})`
      : "";
    throw new Error(
      `Resend rejected the email with status ${response.status}${errorName}`
    );
  }
}

export async function sendEmail(message: EmailMessage) {
  if (!hasEmailDeliveryConfigured()) {
    throw new Error("Resend email delivery is not configured");
  }

  await sendWithResend(message);
}

export async function sendCustomerVerificationCode(email: string, otp: string) {
  await sendEmail({
    to: email,
    subject: "Your Al-Arab verification code",
    text: `Your Al-Arab verification code is ${otp}. It expires in 5 minutes. Do not share this code with anyone.`,
    html: `
      <div style="font-family:Arial,sans-serif;background:#f7f3ea;padding:24px;color:#18120b">
        <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e5d4a3;border-radius:16px;padding:32px;text-align:center">
          <p style="margin:0 0 8px;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#8a6f00">Al-Arab Restaurant</p>
          <h1 style="margin:0 0 20px;font-size:24px">Your verification code</h1>
          <div style="font-size:36px;font-weight:800;letter-spacing:10px;color:#3e2723;background:#fff8dc;border-radius:12px;padding:18px 12px">${otp}</div>
          <p style="margin:22px 0 8px">This code expires in 5 minutes.</p>
          <p style="margin:0;color:#6b6258;font-size:14px">Do not share this code with anyone.</p>
        </div>
      </div>
    `
  });
}
