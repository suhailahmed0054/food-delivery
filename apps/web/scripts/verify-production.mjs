import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd(), false);

const planned = {
  apiOrigin: "https://api.al-arabrestaurant.cc.cd",
  customerOrigin: "https://al-arabrestaurant.cc.cd"
};

const issues = [];

function value(name) {
  const configured = process.env[name]?.trim() ?? "";
  return /^(replace-with|your[-_])/i.test(configured) ? "" : configured;
}

function issue(kind, application, name, expected) {
  issues.push(`${kind} [${application} | PUBLIC] ${name}: expected ${expected}`);
}

function parsePublicHttpsUrl(
  name,
  application,
  expectedPath = "",
  required = true
) {
  const configured = value(name);
  if (!configured) {
    if (required) {
      issue("MISSING", application, name, "a public HTTPS absolute URL");
    }
    return null;
  }

  let parsed;
  try {
    parsed = new URL(configured);
  } catch {
    issue("INVALID", application, name, "a valid absolute URL");
    return null;
  }

  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname) ||
    parsed.search ||
    parsed.hash
  ) {
    issue(
      "INVALID",
      application,
      name,
      "a public HTTPS URL with no credentials, loopback host, query, or fragment"
    );
    return null;
  }

  const normalizedPath = parsed.pathname.replace(/\/+$/, "");
  if (normalizedPath !== expectedPath) {
    issue(
      "INVALID",
      application,
      name,
      expectedPath
        ? `an HTTPS URL ending exactly in ${expectedPath}`
        : "an HTTPS origin without a path"
    );
    return null;
  }

  return parsed;
}

const apiUrl = parsePublicHttpsUrl(
  "NEXT_PUBLIC_API_URL",
  "Customer/Admin Web + Android",
  "/api"
);
if (apiUrl && apiUrl.origin !== planned.apiOrigin) {
  issue(
    "INVALID",
    "Customer/Admin Web + Android",
    "NEXT_PUBLIC_API_URL",
    `${planned.apiOrigin}/api for the planned production structure`
  );
}

const capacitorUrl = parsePublicHttpsUrl(
  "CAPACITOR_SERVER_URL",
  "Capacitor Android",
  "",
  false
);
if (capacitorUrl && capacitorUrl.origin !== planned.customerOrigin) {
  issue(
    "INVALID",
    "Capacitor Android",
    "CAPACITOR_SERVER_URL",
    `${planned.customerOrigin} for the planned production structure`
  );
}

const imageHosts = value("NEXT_PUBLIC_MENU_IMAGE_HOSTS")
  .split(",")
  .map((host) => host.trim().toLowerCase())
  .filter(Boolean);

if (
  imageHosts.length > 0 &&
  imageHosts.some((host) => !/^[a-z0-9.-]+$/.test(host))
) {
  issue(
    "INVALID",
    "Customer/Admin Web",
    "NEXT_PUBLIC_MENU_IMAGE_HOSTS",
    "hostnames only, without protocol, path, port, query, or fragment"
  );
} else if (
  imageHosts.length > 0 &&
  !imageHosts.includes("res.cloudinary.com")
) {
  issue(
    "INVALID",
    "Customer/Admin Web",
    "NEXT_PUBLIC_MENU_IMAGE_HOSTS",
    "a list containing res.cloudinary.com for persistent menu images"
  );
}

if (issues.length > 0) {
  console.error("Web/Android production configuration failed:");
  for (const item of issues) console.error(`- ${item}`);
  process.exitCode = 1;
} else {
  console.log("PASS [Customer/Admin Web + Android] NEXT_PUBLIC_API_URL");
  console.log(
    capacitorUrl
      ? "PASS [Capacitor Android] CAPACITOR_SERVER_URL"
      : "OPTIONAL [Capacitor Android] CAPACITOR_SERVER_URL is not configured"
  );
  console.log(
    imageHosts.length > 0
      ? "PASS [Customer/Admin Web] NEXT_PUBLIC_MENU_IMAGE_HOSTS"
      : "OPTIONAL [Customer/Admin Web] default menu image hosts are in use"
  );
  console.log("Web/Android production configuration verified.");
}
