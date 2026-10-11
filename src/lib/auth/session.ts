import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { SESSION_COOKIE } from "@/lib/constants";
import { env, isProduction } from "@/lib/env";
import { collections } from "@/lib/mongodb/collections";
import { unauthorized } from "@/lib/http/errors";
import { SESSION_TTL_SECONDS, signSessionToken, verifySessionToken } from "./jwt";
import type { UserDoc } from "@/types/domain";

export interface AuthUser {
  id: ObjectId;
  name: string;
  email: string;
  timezone: string;
  createdAt: Date;
}

const toAuthUser = (u: UserDoc): AuthUser => ({
  id: u._id,
  name: u.name,
  email: u.email,
  timezone: u.timezone,
  createdAt: u.createdAt,
});

/** Verifies the token AND that the user still exists with the same token version. */
export async function userFromToken(token: string | undefined | null): Promise<AuthUser | null> {
  if (!token) return null;
  const claims = await verifySessionToken(token, env().JWT_SECRET);
  if (!claims) return null;
  const { users } = await collections();
  const user = await users.findOne({ _id: new ObjectId(claims.sub) });
  if (!user || user.tokenVersion !== claims.tv) return null;
  return toAuthUser(user);
}

export async function authenticateRequest(req: NextRequest): Promise<AuthUser> {
  const user = await userFromToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!user) throw unauthorized();
  return user;
}

/** For Server Components: the signed-in user, or null. Deduplicated per request. */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const store = await cookies();
  return userFromToken(store.get(SESSION_COOKIE)?.value);
});

export async function setSessionCookie(res: NextResponse, user: Pick<UserDoc, "_id" | "tokenVersion">) {
  const token = await signSessionToken({ sub: user._id.toHexString(), tv: user.tokenVersion }, env().JWT_SECRET);
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
