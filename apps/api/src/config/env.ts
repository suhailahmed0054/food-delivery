import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function optionalEnv(name: string) {
  const value = process.env[name]?.trim() ?? "";
  if (
    !value ||
    /^(replace-with|your[-_]|rzp_test_your)/i.test(value) ||
    /^mongodb\+srv:\/\/user:password@/i.test(value)
  ) {
    return "";
  }
  return value;
}

function numericEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function isStrongSecret(value: string) {
  return value.length >= 32 && new Set(value).size >= 10;
}

function isSecureUrl(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

const nodeEnv = process.env.NODE_ENV ?? "development";
const isProduction = nodeEnv === "production";
const clientUrl = optionalEnv("CLIENT_URL") || "http://localhost:3000";
const mongoUri = optionalEnv("MONGODB_URI");
const jwtAccessSecret = optionalEnv("JWT_ACCESS_SECRET");
const jwtRefreshSecret = optionalEnv("JWT_REFRESH_SECRET");
const adminEmail = optionalEnv("ADMIN_EMAIL");
const adminPassword = optionalEnv("ADMIN_PASSWORD");
const razorpayKeyId = optionalEnv("RAZORPAY_KEY_ID");
const razorpayKeySecret = optionalEnv("RAZORPAY_KEY_SECRET");
const razorpayWebhookSecret = optionalEnv("RAZORPAY_WEBHOOK_SECRET");
const redisUrl = optionalEnv("REDIS_URL");
const alertWebhookUrl = optionalEnv("ALERT_WEBHOOK_URL");
const releaseSha = optionalEnv("RELEASE_SHA") || optionalEnv("RENDER_GIT_COMMIT") || "development";
const menuImageHosts = (optionalEnv("MENU_IMAGE_HOSTS") || "images.unsplash.com")
  .split(",")
  .map((host) => host.trim().toLowerCase())
  .filter((host) => /^[a-z0-9.-]+$/.test(host));
const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS ?? (isProduction ? "" : "0"));

if (isProduction) {
  const errors: string[] = [];
  if (!mongoUri) errors.push("MONGODB_URI is required");
  if (!isStrongSecret(jwtAccessSecret)) {
    errors.push("JWT_ACCESS_SECRET must be a strong secret of at least 32 characters");
  }
  if (!isStrongSecret(jwtRefreshSecret)) {
    errors.push("JWT_REFRESH_SECRET must be a strong secret of at least 32 characters");
  }
  if (!isSecureUrl(clientUrl)) errors.push("CLIENT_URL must be a valid HTTPS URL");
  if (!/^\S+@\S+\.\S+$/.test(adminEmail)) errors.push("ADMIN_EMAIL must be valid");
  if (adminPassword.length < 12) {
    errors.push("ADMIN_PASSWORD must contain at least 12 characters");
  }
  if (!razorpayKeyId || !razorpayKeySecret || !razorpayWebhookSecret) {
    errors.push("RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, and RAZORPAY_WEBHOOK_SECRET are required");
  }
  if (!redisUrl) errors.push("REDIS_URL is required for distributed rate limiting");
  if (!isSecureUrl(alertWebhookUrl)) {
    errors.push("ALERT_WEBHOOK_URL must be configured as a valid HTTPS URL");
  }
  if (!Number.isInteger(trustProxyHops) || trustProxyHops < 1) {
    errors.push("TRUST_PROXY_HOPS must be a positive integer matching the deployment proxy chain");
  }
  if (errors.length > 0) {
    throw new Error(`Invalid production configuration:\n- ${errors.join("\n- ")}`);
  }
}

export const env = {
  nodeEnv,
  isProduction,
  port: numericEnv("PORT", 5000),
  clientUrl,
  mongoUri,
  jwtAccessSecret: jwtAccessSecret || "dev-access-secret",
  jwtRefreshSecret: jwtRefreshSecret || "dev-refresh-secret",
  adminEmail: adminEmail || (isProduction ? "" : "admin@alarab.local"),
  adminPassword: adminPassword || (isProduction ? "" : "Admin@123"),
  googleClientId: optionalEnv("GOOGLE_CLIENT_ID"),
  razorpayKeyId,
  razorpayKeySecret,
  razorpayWebhookSecret,
  redisUrl,
  alertWebhookUrl,
  releaseSha,
  shutdownTimeoutMs: numericEnv("SHUTDOWN_TIMEOUT_MS", 10_000),
  menuImageHosts,
  trustProxyHops: Number.isInteger(trustProxyHops) && trustProxyHops >= 0
    ? trustProxyHops
    : 0,
  smtpHost: optionalEnv("SMTP_HOST"),
  smtpPort: numericEnv("SMTP_PORT", 587),
  smtpUser: optionalEnv("SMTP_USER"),
  smtpPass: optionalEnv("SMTP_PASS"),
  twilioAccountSid: optionalEnv("TWILIO_ACCOUNT_SID"),
  twilioAuthToken: optionalEnv("TWILIO_AUTH_TOKEN"),
  twilioFrom: optionalEnv("TWILIO_FROM")
};
