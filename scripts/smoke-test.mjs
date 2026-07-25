const webUrl = normalizeUrl(process.env.DEPLOYMENT_WEB_URL);
const adminUrl = normalizeUrl(process.env.DEPLOYMENT_ADMIN_URL);
const apiUrl = normalizeUrl(process.env.DEPLOYMENT_API_URL);
const allowHttp = process.env.ALLOW_HTTP_SMOKE_TEST === "true";

function normalizeUrl(value) {
  return value?.trim().replace(/\/$/, "") ?? "";
}

function requireUrl(name, value) {
  if (!value) throw new Error(`${name} is required`);
  const parsed = new URL(value);
  if (!allowHttp && parsed.protocol !== "https:") {
    throw new Error(`${name} must use HTTPS`);
  }
}

async function request(name, url, expectedStatus = 200, init = {}) {
  const response = await fetch(url, {
    redirect: "manual",
    ...init,
    signal: AbortSignal.timeout(15_000)
  });
  if (response.status !== expectedStatus) {
    throw new Error(`${name} returned ${response.status}; expected ${expectedStatus}`);
  }
  console.log(`PASS ${name}`);
  return response;
}

async function main() {
  requireUrl("DEPLOYMENT_WEB_URL", webUrl);
  requireUrl("DEPLOYMENT_ADMIN_URL", adminUrl);
  requireUrl("DEPLOYMENT_API_URL", apiUrl);

  const live = await request("API liveness", `${apiUrl}/health/live`);
  const liveBody = await live.json();
  if (!liveBody.ok) throw new Error("API liveness body did not report ok=true");

  const ready = await request("API readiness", `${apiUrl}/health/ready`);
  const readyBody = await ready.json();
  if (
    !readyBody.ok ||
    readyBody.database !== "connected" ||
    !["connected", "disabled"].includes(readyBody.redis)
  ) {
    throw new Error("API dependencies are not ready");
  }

  for (const [label, origin] of [
    ["customer", webUrl],
    ["admin", adminUrl]
  ]) {
    const menu = await request(`Public menu (${label} origin)`, `${apiUrl}/menu`, 200, {
      headers: { Origin: origin }
    });
    if (menu.headers.get("access-control-allow-origin") !== origin) {
      throw new Error(`API CORS does not allow the deployed ${label} origin`);
    }
  }
  await request("Public restaurant settings", `${apiUrl}/settings/public`);
  await request("Protected admin session", `${apiUrl}/auth/me`, 401);
  await request(
    "Legacy phone tracking claim is disabled",
    `${apiUrl}/orders/AR-NOTREAL/tracking/claim`,
    404,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "9999999999" })
    }
  );
  await request("Webhook rejects invalid signatures", `${apiUrl}/payments/webhook`, 400, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-razorpay-signature": "invalid"
    },
    body: JSON.stringify({ event: "payment.captured" })
  });

  for (const route of ["/mobile", "/login", "/checkout", "/admin/login"]) {
    const response = await request(`Web ${route}`, `${webUrl}${route}`);
    for (const header of ["x-content-type-options", "x-frame-options", "strict-transport-security"]) {
      if (!response.headers.get(header)) {
        throw new Error(`Web ${route} is missing ${header}`);
      }
    }
  }

  const adminRoot = await request("Admin subdomain root", adminUrl, 307);
  const adminLocation = adminRoot.headers.get("location");
  if (!adminLocation || new URL(adminLocation, adminUrl).pathname !== "/admin") {
    throw new Error("Admin subdomain root does not redirect to /admin");
  }

  console.log("Deployment smoke test passed.");
}

main().catch((error) => {
  console.error(`Smoke test failed: ${error.message}`);
  process.exitCode = 1;
});
