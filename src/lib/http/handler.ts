import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { ZodError, type ZodType, z } from "zod";
import { ApiError } from "./errors";
import { authenticateRequest, type AuthUser } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/auth/csrf";

export interface ErrorBody {
  error: { code: string; message: string; fields?: Record<string, string[]>; [k: string]: unknown };
}

export function json<T>(data: T, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function zodFields(error: ZodError): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_root";
    (fields[key] ??= []).push(issue.message);
  }
  return fields;
}

export function errorResponse(err: unknown) {
  // Let Next.js handle its own control-flow errors (dynamic bail-out, redirect, notFound).
  unstable_rethrow(err);
  if (err instanceof ApiError) {
    const { fields, ...rest } = err.details ?? {};
    const body: ErrorBody = { error: { code: err.code, message: err.message, ...rest } };
    if (fields) body.error.fields = fields;
    const headers: Record<string, string> = { "Cache-Control": "no-store" };
    if (typeof rest.retryAfter === "number") headers["Retry-After"] = String(rest.retryAfter);
    return NextResponse.json(body, { status: err.status, headers });
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Some fields are invalid", fields: zodFields(err) } },
      { status: 422 },
    );
  }
  // Never leak internals. Log only the error name/message, not request data.
  const e = err as Error;
  console.error(`[api] unhandled ${e?.name ?? "Error"}: ${e?.message ?? String(err)}`);
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } },
    { status: 500 },
  );
}

export async function readJson<S extends ZodType>(req: NextRequest, schema: S): Promise<z.output<S>> {
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > 1_000_000) throw new ApiError("PAYLOAD_TOO_LARGE", "Request body is too large");
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ApiError("BAD_REQUEST", "Request body must be valid JSON");
  }
  return schema.parse(body);
}

type Ctx<P> = { params: Promise<P> };

/** Public route: error handling + CSRF check on mutations. */
export function publicRoute<P = Record<string, string>>(
  fn: (req: NextRequest, ctx: Ctx<P>) => Promise<Response>,
) {
  return async (req: NextRequest, ctx: Ctx<P>) => {
    try {
      assertSameOrigin(req);
      return await fn(req, ctx);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

/** Authenticated route: verifies the session against the database before running `fn`. */
export function authedRoute<P = Record<string, string>>(
  fn: (req: NextRequest, user: AuthUser, params: P) => Promise<Response>,
) {
  return async (req: NextRequest, ctx: Ctx<P>) => {
    try {
      assertSameOrigin(req);
      const user = await authenticateRequest(req);
      return await fn(req, user, await ctx.params);
    } catch (err) {
      return errorResponse(err);
    }
  };
}
