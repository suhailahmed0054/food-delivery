import type { CapacitorConfig } from "@capacitor/cli";

const developmentServerUrl = process.env.CAPACITOR_SERVER_URL?.trim();

function capacitorDevelopmentServer() {
  if (!developmentServerUrl) return undefined;

  const url = new URL(developmentServerUrl);
  const isPrivateLanHttp =
    url.protocol === "http:" &&
    (
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      /^10\./.test(url.hostname) ||
      /^192\.168\./.test(url.hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(url.hostname)
    );

  if (url.protocol !== "https:" && !isPrivateLanHttp) {
    throw new Error(
      "CAPACITOR_SERVER_URL must use HTTPS or a private-LAN HTTP address for development"
    );
  }

  return {
    url: url.toString(),
    cleartext: isPrivateLanHttp
  };
}

const config: CapacitorConfig = {
  appId: "com.alarabrestaurant.app",
  appName: "Al-Arab Restaurant",
  webDir: "capacitor-shell",
  server: capacitorDevelopmentServer()
};

export default config;
