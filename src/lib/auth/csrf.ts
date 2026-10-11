import "server-only";
import type { NextRequest } from "next/server";
import { ApiError } from "@/lib/http/errors";
import { env } from "@/lib/env";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF defence for cookie-authenticated mutations (in addition to SameSite=Lax):
 * a browser request must come from our own origin. Requests without Origin and
 * without Sec-Fetch-Site are non-browser clients, which cannot ride a victim's cookies.
 */
export function assertSameOrigin(req: NextRequest) {
  if (SAFE_METHODS.has(req.method)) return;

  const origin = req.headers.get("origin");
  if (origin) {
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      throw new ApiError("FORBIDDEN", "Cross-origin request blocked");
    }
    const allowed = new Set<string>();
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    if (host) allowed.add(host);
    try {
      allowed.add(new URL(env().APP_URL).host);
    } catch {
      /* env validated elsewhere */
    }
    if (!allowed.has(originHost)) throw new ApiError("FORBIDDEN", "Cross-origin request blocked");
    return;
  }

  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") {
    throw new ApiError("FORBIDDEN", "Cross-origin request blocked");
  }
}
