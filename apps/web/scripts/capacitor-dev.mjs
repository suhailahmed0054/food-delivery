import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { resolve } from "node:path";

function privateLanAddress() {
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family !== "IPv4" || address.internal) continue;
      if (
        /^10\./.test(address.address) ||
        /^192\.168\./.test(address.address) ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(address.address)
      ) {
        return address.address;
      }
    }
  }
  return null;
}

function capacitorCommand(args, serverUrl) {
  const capacitorCli = resolve(
    import.meta.dirname,
    "../../../node_modules/@capacitor/cli/bin/capacitor"
  );
  const result = spawnSync(
    process.execPath,
    [capacitorCli, ...args],
    {
      cwd: resolve(import.meta.dirname, ".."),
      env: {
        ...process.env,
        CAPACITOR_SERVER_URL: serverUrl
      },
      stdio: "inherit"
    }
  );

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Capacitor ${args.join(" ")} failed with exit code ${result.status}`);
  }
}

async function requireReachable(name, url) {
  try {
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(10_000)
    });
    if (response.status < 200 || response.status >= 400) {
      throw new Error(`returned ${response.status}`);
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`${name} is not reachable at ${url}: ${detail}`);
  }
}

const configuredUrl = process.env.CAPACITOR_SERVER_URL?.trim();
const lanAddress = privateLanAddress();
const serverUrl = configuredUrl ||
  (lanAddress ? `http://${lanAddress}:3000/mobile` : "");

if (!serverUrl) {
  throw new Error(
    "No private LAN address was found. Set CAPACITOR_SERVER_URL to the website URL."
  );
}

const parsedServerUrl = new URL(serverUrl);
await requireReachable("Website", serverUrl);

if (parsedServerUrl.protocol === "http:" && parsedServerUrl.hostname !== "localhost") {
  await requireReachable(
    "API",
    `http://${parsedServerUrl.hostname}:5000/api/health/live`
  );
}

const androidDirectory = resolve(import.meta.dirname, "../android");
capacitorCommand(
  existsSync(androidDirectory) ? ["sync", "android"] : ["add", "android"],
  serverUrl
);

console.log(`Android development server: ${serverUrl}`);
console.log("Keep the web and API development servers running while using the Android app.");
