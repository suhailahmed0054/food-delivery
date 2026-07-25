import type { NextConfig } from "next";

if (process.env.NODE_ENV === "production") {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.trim() ?? "";
  let secureApiUrl = false;

  if (apiUrl) {
    try {
      const parsedApiUrl = new URL(apiUrl);
      secureApiUrl =
        parsedApiUrl.protocol === "https:" &&
        !parsedApiUrl.username &&
        !parsedApiUrl.password &&
        !parsedApiUrl.search &&
        !parsedApiUrl.hash &&
        !["localhost", "127.0.0.1", "::1"].includes(parsedApiUrl.hostname);
    } catch {
      secureApiUrl = false;
    }
  }

  if (!secureApiUrl) {
    throw new Error("NEXT_PUBLIC_API_URL must be configured as a valid HTTPS URL for production");
  }
}

const nextConfig: NextConfig = {
  // Keep `next dev` isolated from `next build` so Windows cannot race while
  // replacing manifests when both commands are run from separate terminals.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  images: {
    remotePatterns: (process.env.NEXT_PUBLIC_MENU_IMAGE_HOSTS ?? "images.unsplash.com,res.cloudinary.com")
      .split(",")
      .map((hostname) => hostname.trim().toLowerCase())
      .filter((hostname) => /^[a-z0-9.-]+$/.test(hostname))
      .map((hostname) => ({ protocol: "https" as const, hostname }))
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }
        ]
      }
    ];
  }
};

export default nextConfig;
