import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken } from "@/lib/auth/jwt";
import { SESSION_COOKIE } from "@/lib/constants";

// Optimistic redirects only (signature + expiry). Every page and API still
// verifies the session against the database before touching user data.
const PROTECTED = ["/dashboard", "/problems", "/revision-queue", "/revise", "/settings"];
const AUTH_PAGES = ["/login", "/register"];

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const secret = process.env.JWT_SECRET;
  const valid = Boolean(token && secret && (await verifySessionToken(token, secret)));

  if (PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`)) && !valid) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", `${pathname}${search}`);
    const res = NextResponse.redirect(url);
    if (token) res.cookies.delete(SESSION_COOKIE);
    return res;
  }
  if ((AUTH_PAGES.includes(pathname) || pathname === "/") && valid) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/register", "/dashboard/:path*", "/problems/:path*", "/revision-queue/:path*", "/revise/:path*", "/settings/:path*"],
};
