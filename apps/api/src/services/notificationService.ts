import nodemailer from "nodemailer";
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
  console.log(`SMS placeholder for ${phone}: ${message}`);
}

export async function sendWhatsApp(phone: string, message: string) {
  console.log(`WhatsApp placeholder for ${phone}: ${message}`);
}
