import "server-only";
import type { NextRequest } from "next/server";
import { collections } from "@/lib/mongodb/collections";
import { ApiError } from "@/lib/http/errors";

/**
 * Fixed-window limiter stored in MongoDB so it holds across serverless instances.
 * Expired windows are removed by the TTL index on `expiresAt`.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number, now = Date.now()) {
  const windowStart = Math.floor(now / (windowSeconds * 1000)) * windowSeconds * 1000;
  const expiresAt = new Date(windowStart + windowSeconds * 1000);
  const { rateLimits } = await collections();
  const doc = await rateLimits.findOneAndUpdate(
    { _id: `${key}:${windowStart}` },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt } },
    { upsert: true, returnDocument: "after" },
  );
  if (doc && doc.count > limit) {
    const retryAfter = Math.max(1, Math.ceil((expiresAt.getTime() - now) / 1000));
    throw new ApiError("RATE_LIMITED", "Too many requests. Please wait and try again.", { retryAfter });
  }
}

export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim().slice(0, 64);
  return req.headers.get("x-real-ip")?.slice(0, 64) ?? "unknown";
}
