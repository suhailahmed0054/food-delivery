import { NextRequest, NextResponse } from "next/server";

const adminCookieNames = [
  "al-arab-admin-access",
  "__Host-al-arab-admin-access"
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/admin/login") return NextResponse.next();

  const hasAdminSession = adminCookieNames.some((name) =>
    Boolean(request.cookies.get(name)?.value)
  );
  if (!hasAdminSession) {
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"]
};
