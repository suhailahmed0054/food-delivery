import nodemailer from "nodemailer";
import Twilio from "twilio";
import { env } from "../config/env";

export async function sendOrderEmail(to: string, subject: string, html: string) {
  if (!env.smtpHost || !env.smtpUser || !env.smtpPass) {
    console.log("Email skipped. SMTP is not configured.");
    return;
  }

  const transporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpPort === 465,
    auth: { user: env.smtpUser, pass: env.smtpPass }
  });

  await transporter.sendMail({ from: env.smtpUser, to, subject, html });
}

export async function sendSms(phone: string, message: string) {
  if (!env.twilioAccountSid || !env.twilioAuthToken || !env.twilioFrom) {
    console.log(`SMS skipped (Twilio not configured): ${phone} -> ${message}`);
    return;
  }

  const client = Twilio(env.twilioAccountSid, env.twilioAuthToken);
  await client.messages.create({
    body: message,
    from: env.twilioFrom,
    to: phone
  });
}

export async function sendWhatsApp(phone: string, message: string) {
  if (!env.twilioAccountSid || !env.twilioAuthToken || !env.twilioFrom) {
    console.log(`WhatsApp skipped (Twilio not configured): ${phone} -> ${message}`);
    return;
  }

  const client = Twilio(env.twilioAccountSid, env.twilioAuthToken);
  await client.messages.create({
    body: message,
    from: `whatsapp:${env.twilioFrom}`,
    to: `whatsapp:${phone}`
  });
}
