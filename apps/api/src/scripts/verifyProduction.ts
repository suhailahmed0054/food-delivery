let disconnectDependencies: (() => Promise<unknown>) | undefined;

async function main() {
  process.env.NODE_ENV = "production";

  const [
    { default: mongoose },
    { connectDatabase, isDatabaseConnected },
    { env },
    { connectRedis, disconnectRedis, isRedisConnected }
  ] = await Promise.all([
    import("mongoose"),
    import("../config/db.js"),
    import("../config/env.js"),
    import("../services/redisService.js")
  ]);

  disconnectDependencies = () =>
    Promise.allSettled([disconnectRedis(), mongoose.disconnect()]);

  const plannedOrigins = {
    customer: "https://al-arabrestaurant.cc.cd",
    admin: "https://admin.al-arabrestaurant.cc.cd",
    api: "https://api.al-arabrestaurant.cc.cd"
  };
  const publicUrlChecks = [
    ["CUSTOMER_APP_URL", env.customerAppUrl, plannedOrigins.customer],
    ["ADMIN_APP_URL", env.adminAppUrl, plannedOrigins.admin],
    ["API_PUBLIC_URL", env.apiPublicUrl, plannedOrigins.api]
  ] as const;

  const urlErrors = publicUrlChecks
    .filter(([, actual, expected]) => actual !== expected)
    .map(([name, , expected]) =>
      `INVALID [API | PUBLIC] ${name}: expected ${expected} for the planned production structure`
    );

  for (const requiredOrigin of [plannedOrigins.customer, plannedOrigins.admin]) {
    if (!env.allowedClientOrigins.includes(requiredOrigin)) {
      urlErrors.push(
        `INVALID [API CORS | PUBLIC] ${requiredOrigin}: expected this origin in the allowed customer/admin origin set`
      );
    }
  }

  if (urlErrors.length > 0) {
    throw new Error(`Production URL verification failed:\n- ${urlErrors.join("\n- ")}`);
  }

  const healthUrl = new URL("/api/health/ready", env.apiPublicUrl);
  if (
    healthUrl.protocol !== "https:" ||
    healthUrl.pathname !== "/api/health/ready"
  ) {
    throw new Error(
      "INVALID [API health | PUBLIC] API_PUBLIC_URL: expected a value that resolves /api/health/ready over HTTPS"
    );
  }

  console.log("PASS [API CORS] customer and admin origins");
  console.log("PASS [API health] /api/health/ready configuration");
  console.log("PASS [API OTP] Resend sender, API key, and OTP hash secret are configured");

  await connectDatabase();
  if (!isDatabaseConnected()) throw new Error("MongoDB readiness check failed");

  if (env.redisUrl) {
    await connectRedis();
    if (!isRedisConnected()) throw new Error("Redis readiness check failed");
    console.log("Production dependencies verified: MongoDB and Redis.");
  } else {
    console.log(
      "Production dependency verified: MongoDB. Redis is intentionally disabled; rate limits use process-local memory."
    );
  }
}

void main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown verification error";
    console.error(`Production verification failed: ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDependencies?.();
  });
