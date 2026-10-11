import { SignJWT, jwtVerify } from "jose";

// Kept free of `server-only`/env imports so proxy.ts can use it too.
export const JWT_AUDIENCE = "daily-dsa-progress";
export const JWT_ISSUER = "daily-dsa-progress";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export interface SessionClaims {
  sub: string;
  tv: number;
}

const encode = (secret: string) => new TextEncoder().encode(secret);

export async function signSessionToken(claims: SessionClaims, secret: string): Promise<string> {
  return new SignJWT({ tv: claims.tv })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(claims.sub)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(encode(secret));
}

/** Returns the claims for a valid, unexpired token signed with `secret`; otherwise null. */
export async function verifySessionToken(token: string, secret: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, encode(secret), {
      algorithms: ["HS256"],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      requiredClaims: ["sub", "exp", "iat"],
    });
    if (typeof payload.sub !== "string" || !/^[a-f\d]{24}$/i.test(payload.sub)) return null;
    if (typeof payload.tv !== "number" || !Number.isInteger(payload.tv)) return null;
    return { sub: payload.sub, tv: payload.tv };
  } catch {
    return null;
  }
}
