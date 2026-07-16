import type { Request, Response } from "express";

const isProduction = process.env.NODE_ENV === "production";

export const adminAccessCookieName = isProduction
  ? "__Host-al-arab-admin-access"
  : "al-arab-admin-access";
export const adminRefreshCookieName = isProduction
  ? "__Host-al-arab-admin-refresh"
  : "al-arab-admin-refresh";
export const customerAccessCookieName = isProduction
  ? "__Host-al-arab-customer-access"
  : "al-arab-customer-access";
export const customerRefreshCookieName = isProduction
  ? "__Host-al-arab-customer-refresh"
  : "al-arab-customer-refresh";

function serializeCookie(
  name: string,
  value: string,
  options: { maxAge: number }
) {
  return [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${options.maxAge}`,
    ...(isProduction ? ["Secure"] : [])
  ].join("; ");
}

export function readCookie(req: Request, name: string) {
  return readCookieHeader(req.headers.cookie, name);
}

export function readCookieHeader(cookieHeader: string | undefined, name: string) {
  if (!cookieHeader) return null;

  for (const entry of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = entry.trim().split("=");
    if (rawName === name) {
      return decodeURIComponent(rawValue.join("="));
    }
  }
  return null;
}

export function setAdminAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string
) {
  res.append(
    "Set-Cookie",
    serializeCookie(adminAccessCookieName, accessToken, { maxAge: 15 * 60 })
  );
  res.append(
    "Set-Cookie",
    serializeCookie(adminRefreshCookieName, refreshToken, {
      maxAge: 7 * 24 * 60 * 60
    })
  );
}

export function clearAdminAuthCookies(res: Response) {
  res.append(
    "Set-Cookie",
    serializeCookie(adminAccessCookieName, "", { maxAge: 0 })
  );
  res.append(
    "Set-Cookie",
    serializeCookie(adminRefreshCookieName, "", { maxAge: 0 })
  );
}

export function setCustomerAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string
) {
  res.append(
    "Set-Cookie",
    serializeCookie(customerAccessCookieName, accessToken, { maxAge: 15 * 60 })
  );
  res.append(
    "Set-Cookie",
    serializeCookie(customerRefreshCookieName, refreshToken, {
      maxAge: 7 * 24 * 60 * 60
    })
  );
}

export function clearCustomerAuthCookies(res: Response) {
  res.append(
    "Set-Cookie",
    serializeCookie(customerAccessCookieName, "", { maxAge: 0 })
  );
  res.append(
    "Set-Cookie",
    serializeCookie(customerRefreshCookieName, "", { maxAge: 0 })
  );
}
