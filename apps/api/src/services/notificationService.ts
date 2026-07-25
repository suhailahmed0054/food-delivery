import Twilio from "twilio";
import { env } from "../config/env";
import { hasEmailDeliveryConfigured, sendEmail } from "./emailService";

export async function sendOrderEmail(to: string, subject: string, html: string) {
  if (!hasEmailDeliveryConfigured()) {
    console.log("Email skipped. Email delivery is not configured.");
    return;
  }
  await sendEmail({ to, subject, html });
}

export async function sendSms(phone: string, message: string) {
  if (!env.twilioAccountSid || !env.twilioAuthToken || !env.twilioFrom) {
    if (!env.isProduction) {
      console.log("SMS skipped because Twilio is not configured.");
    }
    return;
  }

  const client = Twilio(env.twilioAccountSid, env.twilioAuthToken);
  await client.messages.create({
    body: message,
    from: env.twilioFrom,
    to: phone
  });
}
