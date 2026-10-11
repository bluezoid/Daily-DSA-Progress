import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import { call, disconnect, resetDb } from "../helpers";
import * as register from "@/app/api/auth/register/route";
import * as login from "@/app/api/auth/login/route";
import * as me from "@/app/api/auth/me/route";
import * as password from "@/app/api/auth/password/route";
import * as problems from "@/app/api/problems/route";
import { getDb } from "@/lib/mongodb/client";
import { signSessionToken } from "@/lib/auth/jwt";

const creds = { name: "Ada", email: "  Ada@Example.COM ", password: "a-strong-password", timezone: "Europe/London" };

function cookieToken(headers: Headers) {
  const m = /dsa_session=([^;]+)/.exec(headers.get("set-cookie") ?? "");
  return m?.[1];
}

beforeEach(resetDb);
afterAll(disconnect);

describe("registration and login", () => {
  it("registers, normalizes email, hashes the password and sets an httpOnly cookie", async () => {
    const res = await call(register.POST, { method: "POST", body: creds });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: "ada@example.com", timezone: "Europe/London" });
    expect(res.body.user.passwordHash).toBeUndefined();
    const cookie = res.headers.get("set-cookie")!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=lax/i);

    const stored = await (await getDb()).collection("users").findOne({ email: "ada@example.com" });
    expect(stored!.passwordHash).toMatch(/^\$argon2id\$/);
    expect(stored!.passwordHash).not.toContain(creds.password);
  });

  it("rejects duplicate emails without confirming the account exists", async () => {
    await call(register.POST, { method: "POST", body: creds });
    const res = await call(register.POST, { method: "POST", body: { ...creds, email: "ada@example.com" } });
    expect(res.status).toBe(409);
    expect(res.body.error.message).not.toMatch(/already exists|taken/i);
  });

  it("validates input", async () => {
    const res = await call(register.POST, { method: "POST", body: { name: "", email: "nope", password: "short" } });
    expect(res.status).toBe(422);
    expect(Object.keys(res.body.error.fields)).toEqual(expect.arrayContaining(["name", "email", "password"]));
  });

  it("logs in with correct credentials and gives one generic error otherwise", async () => {
    await call(register.POST, { method: "POST", body: creds });
    const ok = await call(login.POST, { method: "POST", body: { email: "ADA@example.com", password: creds.password } });
    expect(ok.status).toBe(200);
    expect(cookieToken(ok.headers)).toBeTruthy();

    const wrongPw = await call(login.POST, { method: "POST", body: { email: "ada@example.com", password: "nope-nope" } });
    const noUser = await call(login.POST, { method: "POST", body: { email: "ghost@example.com", password: "nope-nope" } });
    expect(wrongPw.status).toBe(401);
    expect(noUser.status).toBe(401);
    expect(wrongPw.body.error.message).toBe(noUser.body.error.message);
  });

  it("rate limits repeated login attempts per email", async () => {
    let last = 0;
    for (let i = 0; i < 11; i++) {
      last = (await call(login.POST, { method: "POST", body: { email: "x@example.com", password: "whatever1" } })).status;
    }
    expect(last).toBe(429);
  });
});

describe("sessions", () => {
  it("protects APIs from unauthenticated requests", async () => {
    expect((await call(me.GET)).status).toBe(401);
    expect((await call(problems.GET)).status).toBe(401);
    expect((await call(problems.POST, { method: "POST", body: { title: "x" } })).status).toBe(401);
  });

  it("rejects tampered, wrongly signed and expired tokens", async () => {
    const reg = await call(register.POST, { method: "POST", body: creds });
    const token = cookieToken(reg.headers)!;
    expect((await call(me.GET, { token })).status).toBe(200);

    const tampered = token.slice(0, -3) + (token.endsWith("aaa") ? "bbb" : "aaa");
    expect((await call(me.GET, { token: tampered })).status).toBe(401);

    const forged = await signSessionToken({ sub: reg.body.user.id, tv: 0 }, "another-secret-that-is-long-enough-123");
    expect((await call(me.GET, { token: forged })).status).toBe(401);

    const expired = await new SignJWT({ tv: 0 })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(reg.body.user.id)
      .setIssuer("daily-dsa-progress")
      .setAudience("daily-dsa-progress")
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(new TextEncoder().encode(process.env.JWT_SECRET));
    expect((await call(me.GET, { token: expired })).status).toBe(401);

    const unsigned = `${Buffer.from('{"alg":"none"}').toString("base64url")}.${Buffer.from(
      JSON.stringify({ sub: reg.body.user.id, tv: 0 }),
    ).toString("base64url")}.`;
    expect((await call(me.GET, { token: unsigned })).status).toBe(401);
  });

  it("invalidates old sessions after a password change", async () => {
    const reg = await call(register.POST, { method: "POST", body: creds });
    const oldToken = cookieToken(reg.headers)!;
    const res = await call(password.POST, {
      method: "POST",
      token: oldToken,
      body: { currentPassword: creds.password, newPassword: "another-strong-pass" },
    });
    expect(res.status).toBe(200);
    expect((await call(me.GET, { token: oldToken })).status).toBe(401);
    expect((await call(me.GET, { token: cookieToken(res.headers) })).status).toBe(200);
  });

  it("blocks cross-origin mutations", async () => {
    const reg = await call(register.POST, { method: "POST", body: creds });
    const res = await call(problems.POST, {
      method: "POST",
      token: cookieToken(reg.headers),
      body: { title: "CSRF" },
      headers: { origin: "https://evil.example" },
    });
    expect(res.status).toBe(403);
  });
});
