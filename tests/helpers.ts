import { NextRequest } from "next/server";
import { closeMongo, getDb } from "@/lib/mongodb/client";
import { resetIndexCache } from "@/lib/mongodb/collections";
import { signSessionToken } from "@/lib/auth/jwt";
import { SESSION_COOKIE } from "@/lib/constants";
import type { AuthUser } from "@/lib/auth/session";
import { registerUser } from "@/services/users/user.service";

export async function resetDb() {
  const db = await getDb();
  await Promise.all(
    ["users", "problems", "solutionVersions", "revisionSessions", "rateLimits"].map((c) =>
      db.collection(c).deleteMany({}),
    ),
  );
}

export async function disconnect() {
  resetIndexCache();
  await closeMongo();
}

let counter = 0;
export async function createUser(name = "User", timezone = "UTC"): Promise<AuthUser & { token: string }> {
  counter++;
  const doc = await registerUser({
    name,
    email: `${name.toLowerCase().replace(/\W/g, "")}${counter}-${Date.now()}@example.com`,
    password: "correct horse battery",
    timezone,
  });
  const token = await signSessionToken({ sub: doc._id.toHexString(), tv: doc.tokenVersion }, process.env.JWT_SECRET!);
  return { id: doc._id, name: doc.name, email: doc.email, timezone: doc.timezone, createdAt: doc.createdAt, token };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (req: NextRequest, ctx: { params: Promise<any> }) => Promise<Response>;

/** Invokes a route handler the way Next.js would. */
export async function call(
  handler: Handler,
  opts: {
    method?: string;
    url?: string;
    body?: unknown;
    token?: string;
    params?: Record<string, string>;
    headers?: Record<string, string>;
  } = {},
) {
  const headers = new Headers({ host: "localhost:3000", ...opts.headers });
  if (opts.body !== undefined) headers.set("content-type", "application/json");
  if (opts.token) headers.set("cookie", `${SESSION_COOKIE}=${opts.token}`);
  const req = new NextRequest(new URL(opts.url ?? "/api/test", "http://localhost:3000"), {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const res = await handler(req, { params: Promise.resolve(opts.params ?? {}) });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null, headers: res.headers };
}
