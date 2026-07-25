import path from "path";
import dotenv from "dotenv";

const apiRoot = path.resolve(__dirname, "../..");
const environmentFiles =
  process.env.NODE_ENV === "production"
    ? [".env.production.local", ".env.production", ".env"]
    : [".env.local", ".env"];

for (const fileName of environmentFiles) {
  dotenv.config({
    path: path.join(apiRoot, fileName),
    override: false
  });
}

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

type ConfigurationVisibility = "PUBLIC" | "SECRET" | "PRIVATE";
type ConfigurationIssueKind = "MISSING" | "INVALID";

function configurationIssue(
  kind: ConfigurationIssueKind,
  name: string,
  visibility: ConfigurationVisibility,
  expected: string
) {
  return `${kind} [API | ${visibility}] ${name}: expected ${expected}`;
}

function isProductionHttpsUrl(value: string, requireOriginOnly = false) {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      ["localhost", "127.0.0.1", "::1"].includes(url.hostname)
    ) {
      return false;
    }
    return !requireOriginOnly || (
      (url.pathname === "/" || url.pathname === "") &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

function hasUrlProtocol(value: string, protocols: string[]) {
  try {
    return protocols.includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function emailSenderAddress(value: string) {
  if (!value || /[\r\n]/.test(value)) return "";
  const bracketed = value.match(/^(?:[^<>]{1,100}\s*)?<([^<>\s]+)>$/);
  if (value.includes("<") || value.includes(">")) {
    return bracketed?.[1] ?? "";
  }
  return value;
}

function isValidEmailSender(value: string) {
  const address = emailSenderAddress(value);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return false;
  const domain = address.split("@")[1]?.toLowerCase() ?? "";
  return domain === "al-arabrestaurant.cc.cd" ||
    domain.endsWith(".al-arabrestaurant.cc.cd");
}

const nodeEnv = process.env.NODE_ENV ?? "development";
const isProduction = nodeEnv === "production";
const configuredCustomerAppUrl = optionalEnv("CUSTOMER_APP_URL");
const configuredAdminAppUrl = optionalEnv("ADMIN_APP_URL");
const customerAppUrl =
  configuredCustomerAppUrl || (isProduction ? "" : "http://localhost:3000");
const adminAppUrl =
  configuredAdminAppUrl || (isProduction ? "" : customerAppUrl);
const apiPublicUrl = optionalEnv("API_PUBLIC_URL");
const allowedClientOrigins = Array.from(
  new Set([customerAppUrl, adminAppUrl].filter(Boolean))
);
const mongoUri = optionalEnv("MONGODB_URI");
const mongoDatabaseName = optionalEnv("MONGODB_DATABASE") || "alarab";
const jwtAccessSecret = optionalEnv("JWT_ACCESS_SECRET");
const jwtRefreshSecret = optionalEnv("JWT_REFRESH_SECRET");
const authSecret = optionalEnv("AUTH_SECRET");
const otpHashSecret = optionalEnv("OTP_HASH_SECRET");
const resendApiKey = optionalEnv("RESEND_API_KEY");
const emailFrom = optionalEnv("EMAIL_FROM");
const adminEmail = optionalEnv("ADMIN_EMAIL");
const adminPassword = optionalEnv("ADMIN_PASSWORD");
const razorpayKeyId = optionalEnv("RAZORPAY_KEY_ID");
const razorpayKeySecret = optionalEnv("RAZORPAY_KEY_SECRET");
const razorpayWebhookSecret = optionalEnv("RAZORPAY_WEBHOOK_SECRET");
const redisUrl = optionalEnv("REDIS_URL");
const alertWebhookUrl = optionalEnv("ALERT_WEBHOOK_URL");
const cloudinaryCloudName = optionalEnv("CLOUDINARY_CLOUD_NAME");
const cloudinaryApiKey = optionalEnv("CLOUDINARY_API_KEY");
const cloudinaryApiSecret = optionalEnv("CLOUDINARY_API_SECRET");
const twilioAccountSid = optionalEnv("TWILIO_ACCOUNT_SID");
const twilioAuthToken = optionalEnv("TWILIO_AUTH_TOKEN");
const twilioFrom = optionalEnv("TWILIO_FROM");
const releaseSha = optionalEnv("RELEASE_SHA") || optionalEnv("RENDER_GIT_COMMIT") || "development";
const mongoDnsServers = (optionalEnv("MONGODB_DNS_SERVERS") || (isProduction ? "" : "1.1.1.1,8.8.8.8"))
  .split(",")
  .map((server) => server.trim())
  .filter(Boolean);
const menuImageHosts = (optionalEnv("MENU_IMAGE_HOSTS") || "images.unsplash.com,res.cloudinary.com")
  .split(",")
  .map((host) => host.trim().toLowerCase())
  .filter((host) => /^[a-z0-9.-]+$/.test(host));
const trustProxyHopsValue = optionalEnv("TRUST_PROXY_HOPS");
const trustProxyHops = Number(
  trustProxyHopsValue || (isProduction ? Number.NaN : 0)
);

if (isProduction) {
  const errors: string[] = [];
  if (!mongoUri) {
    errors.push(configurationIssue(
      "MISSING",
      "MONGODB_URI",
      "SECRET",
      "a MongoDB Atlas mongodb+srv:// connection string"
    ));
  }
  else if (!hasUrlProtocol(mongoUri, ["mongodb:", "mongodb+srv:"])) {
    errors.push(configurationIssue(
      "INVALID",
      "MONGODB_URI",
      "SECRET",
      "a URL using the mongodb:// or mongodb+srv:// protocol"
    ));
  }
  if (!jwtAccessSecret) {
    errors.push(configurationIssue(
      "MISSING",
      "JWT_ACCESS_SECRET",
      "SECRET",
      "a unique random string of at least 32 characters"
    ));
  } else if (!isStrongSecret(jwtAccessSecret)) {
    errors.push(configurationIssue(
      "INVALID",
      "JWT_ACCESS_SECRET",
      "SECRET",
      "a unique random string of at least 32 characters with sufficient variety"
    ));
  }
  if (!jwtRefreshSecret) {
    errors.push(configurationIssue(
      "MISSING",
      "JWT_REFRESH_SECRET",
      "SECRET",
      "a different random string of at least 32 characters"
    ));
  } else if (!isStrongSecret(jwtRefreshSecret)) {
    errors.push(configurationIssue(
      "INVALID",
      "JWT_REFRESH_SECRET",
      "SECRET",
      "a different random string of at least 32 characters with sufficient variety"
    ));
  }
  if (!authSecret) {
    errors.push(configurationIssue(
      "MISSING",
      "AUTH_SECRET",
      "SECRET",
      "a unique random string of at least 32 characters"
    ));
  } else if (!isStrongSecret(authSecret)) {
    errors.push(configurationIssue(
      "INVALID",
      "AUTH_SECRET",
      "SECRET",
      "a unique random string of at least 32 characters with sufficient variety"
    ));
  }
  if (!otpHashSecret) {
    errors.push(configurationIssue(
      "MISSING",
      "OTP_HASH_SECRET",
      "SECRET",
      "a unique random string of at least 32 characters"
    ));
  } else if (!isStrongSecret(otpHashSecret)) {
    errors.push(configurationIssue(
      "INVALID",
      "OTP_HASH_SECRET",
      "SECRET",
      "a unique random string of at least 32 characters with sufficient variety"
    ));
  }
  const configuredAuthenticationSecrets = [
    jwtAccessSecret,
    jwtRefreshSecret,
    authSecret,
    otpHashSecret
  ].filter(Boolean);
  if (
    new Set(configuredAuthenticationSecrets).size !==
    configuredAuthenticationSecrets.length
  ) {
    errors.push(configurationIssue(
      "INVALID",
      "JWT_ACCESS_SECRET / JWT_REFRESH_SECRET / AUTH_SECRET / OTP_HASH_SECRET",
      "SECRET",
      "four different random values; authentication and OTP secrets must not be reused"
    ));
  }
  if (!resendApiKey) {
    errors.push(configurationIssue(
      "MISSING",
      "RESEND_API_KEY",
      "SECRET",
      "a Resend API key"
    ));
  } else if (!resendApiKey.startsWith("re_") || resendApiKey.length < 12) {
    errors.push(configurationIssue(
      "INVALID",
      "RESEND_API_KEY",
      "SECRET",
      "a Resend API key beginning with re_"
    ));
  }
  if (!emailFrom) {
    errors.push(configurationIssue(
      "MISSING",
      "EMAIL_FROM",
      "PRIVATE",
      "a sender such as Al-Arab Restaurant <login@verified-domain>"
    ));
  } else if (!isValidEmailSender(emailFrom)) {
    errors.push(configurationIssue(
      "INVALID",
      "EMAIL_FROM",
      "PRIVATE",
      "a valid sender at al-arabrestaurant.cc.cd or one of its verified subdomains"
    ));
  }
  if (!configuredCustomerAppUrl) {
    errors.push(configurationIssue(
      "MISSING",
      "CUSTOMER_APP_URL",
      "PUBLIC",
      "the customer website HTTPS origin without a path"
    ));
  } else if (!isProductionHttpsUrl(configuredCustomerAppUrl, true)) {
    errors.push(configurationIssue(
      "INVALID",
      "CUSTOMER_APP_URL",
      "PUBLIC",
      "a public HTTPS origin without credentials, path, query, or fragment"
    ));
  }
  if (!configuredAdminAppUrl) {
    errors.push(configurationIssue(
      "MISSING",
      "ADMIN_APP_URL",
      "PUBLIC",
      "the admin website HTTPS origin without a path"
    ));
  } else if (!isProductionHttpsUrl(configuredAdminAppUrl, true)) {
    errors.push(configurationIssue(
      "INVALID",
      "ADMIN_APP_URL",
      "PUBLIC",
      "a public HTTPS origin without credentials, path, query, or fragment"
    ));
  }
  if (!apiPublicUrl) {
    errors.push(configurationIssue(
      "MISSING",
      "API_PUBLIC_URL",
      "PUBLIC",
      "the backend API HTTPS origin without /api"
    ));
  } else if (!isProductionHttpsUrl(apiPublicUrl, true)) {
    errors.push(configurationIssue(
      "INVALID",
      "API_PUBLIC_URL",
      "PUBLIC",
      "a public HTTPS origin without credentials, path, query, or fragment"
    ));
  }
  if (adminEmail && !/^\S+@\S+\.\S+$/.test(adminEmail)) {
    errors.push(configurationIssue(
      "INVALID",
      "ADMIN_EMAIL",
      "PRIVATE",
      "a valid email address when running the one-time admin seed command"
    ));
  }
  if (adminPassword && adminPassword.length < 12) {
    errors.push(configurationIssue(
      "INVALID",
      "ADMIN_PASSWORD",
      "SECRET",
      "a unique password of at least 12 characters when running the one-time admin seed command"
    ));
  }
  if (Boolean(adminEmail) !== Boolean(adminPassword)) {
    errors.push(configurationIssue(
      "INVALID",
      "ADMIN_EMAIL / ADMIN_PASSWORD",
      "SECRET",
      "both one-time seed values together, or neither during normal API startup"
    ));
  }
  const razorpayConfigurationCount = [
    razorpayKeyId,
    razorpayKeySecret,
    razorpayWebhookSecret
  ].filter(Boolean).length;
  if (razorpayConfigurationCount > 0 && razorpayConfigurationCount < 3) {
    errors.push(configurationIssue(
      "INVALID",
      "RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET / RAZORPAY_WEBHOOK_SECRET",
      "SECRET",
      "all three Razorpay values together, or all three empty when online payment is disabled"
    ));
  }
  if (redisUrl && !hasUrlProtocol(redisUrl, ["redis:", "rediss:"])) {
    errors.push(configurationIssue(
      "INVALID",
      "REDIS_URL",
      "SECRET",
      "a URL using the redis:// or rediss:// protocol"
    ));
  }
  if (alertWebhookUrl && !isProductionHttpsUrl(alertWebhookUrl)) {
    errors.push(configurationIssue(
      "INVALID",
      "ALERT_WEBHOOK_URL",
      "SECRET",
      "an HTTPS URL with no embedded credentials"
    ));
  }
  if (!cloudinaryCloudName) {
    errors.push(configurationIssue(
      "MISSING",
      "CLOUDINARY_CLOUD_NAME",
      "PUBLIC",
      "the Cloudinary cloud name"
    ));
  }
  if (!cloudinaryApiKey) {
    errors.push(configurationIssue(
      "MISSING",
      "CLOUDINARY_API_KEY",
      "SECRET",
      "the Cloudinary API key"
    ));
  }
  if (!cloudinaryApiSecret) {
    errors.push(configurationIssue(
      "MISSING",
      "CLOUDINARY_API_SECRET",
      "SECRET",
      "the Cloudinary API secret"
    ));
  }
  if (!Number.isInteger(trustProxyHops) || trustProxyHops < 1) {
    errors.push(configurationIssue(
      trustProxyHopsValue ? "INVALID" : "MISSING",
      "TRUST_PROXY_HOPS",
      "PRIVATE",
      "a positive integer matching the hosting proxy chain"
    ));
  }
  const twilioConfigurationCount = [
    twilioAccountSid,
    twilioAuthToken,
    twilioFrom
  ].filter(Boolean).length;
  if (twilioConfigurationCount > 0 && twilioConfigurationCount < 3) {
    errors.push(configurationIssue(
      "INVALID",
      "TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM",
      "SECRET",
      "all three SMS values together, or all three empty when SMS is disabled"
    ));
  }
  if (errors.length > 0) {
    throw new Error(`Invalid production configuration:\n- ${errors.join("\n- ")}`);
  }
}

export const env = {
  nodeEnv,
  isProduction,
  port: numericEnv("PORT", 5000),
  customerAppUrl,
  adminAppUrl,
  apiPublicUrl,
  allowedClientOrigins,
  mongoUri,
  mongoDatabaseName,
  jwtAccessSecret: jwtAccessSecret || "dev-access-secret",
  jwtRefreshSecret: jwtRefreshSecret || "dev-refresh-secret",
  authSecret: authSecret || "dev-auth-secret-change-before-production",
  otpHashSecret,
  resendApiKey,
  emailFrom,
  adminEmail: adminEmail || (isProduction ? "" : "admin@alarab.local"),
  adminPassword: adminPassword || (isProduction ? "" : "Admin@123"),
  usesDemoAdminCredentials: !isProduction && (!adminEmail || !adminPassword),
  razorpayKeyId,
  razorpayKeySecret,
  razorpayWebhookSecret,
  redisUrl,
  alertWebhookUrl,
  cloudinaryCloudName,
  cloudinaryApiKey,
  cloudinaryApiSecret,
  mongoDnsServers,
  releaseSha,
  shutdownTimeoutMs: numericEnv("SHUTDOWN_TIMEOUT_MS", 10_000),
  menuImageHosts,
  trustProxyHops: Number.isInteger(trustProxyHops) && trustProxyHops >= 0
    ? trustProxyHops
    : 0,
  twilioAccountSid,
  twilioAuthToken,
  twilioFrom
};
