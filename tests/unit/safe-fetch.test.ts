import { describe, expect, it } from "vitest";
import { isPrivateAddress, safeFetch, SafeFetchError, type Transport } from "@/services/leetcode/safe-fetch";
import { previewLeetCodeImport, type Fetcher } from "@/services/leetcode/importer";
import { MOCK_QUESTION } from "@/services/leetcode/mock-fixture";

const hosts = new Set(["leetcode.com"]);

describe("isPrivateAddress", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fe80::1", "fd00::1", "::ffff:127.0.0.1", "224.0.0.1"])(
    "blocks %s",
    (ip) => expect(isPrivateAddress(ip)).toBe(true),
  );
  it.each(["104.18.32.1", "2606:4700::6810:1"])("allows public %s", (ip) => expect(isPrivateAddress(ip)).toBe(false));
});

describe("safeFetch", () => {
  const ok: Transport = async () => ({ status: 200, headers: {}, body: "ok" });

  it("rejects hosts outside the allowlist and non-https", async () => {
    await expect(safeFetch("https://evil.com/x", { allowedHosts: hosts }, ok)).rejects.toMatchObject({ kind: "blocked_host" });
    await expect(safeFetch("http://leetcode.com/x", { allowedHosts: hosts }, ok)).rejects.toMatchObject({ kind: "blocked_host" });
  });

  it("validates every redirect target", async () => {
    const redirectToInternal: Transport = async ({ url }) =>
      url.hostname === "leetcode.com"
        ? { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data" }, body: "" }
        : { status: 200, headers: {}, body: "secret" };
    await expect(safeFetch("https://leetcode.com/a", { allowedHosts: hosts }, redirectToInternal)).rejects.toBeInstanceOf(
      SafeFetchError,
    );

    const redirectToOtherHost: Transport = async () => ({ status: 301, headers: { location: "https://attacker.test/" }, body: "" });
    await expect(safeFetch("https://leetcode.com/a", { allowedHosts: hosts }, redirectToOtherHost)).rejects.toMatchObject({
      kind: "blocked_host",
    });
  });

  it("follows allowed redirects up to the limit", async () => {
    let n = 0;
    const loop: Transport = async () => ({ status: 302, headers: { location: `/r${++n}` }, body: "" });
    await expect(safeFetch("https://leetcode.com/a", { allowedHosts: hosts, maxRedirects: 2 }, loop)).rejects.toMatchObject({
      kind: "too_many_redirects",
    });
  });

  it("strips cookie and authorization headers", async () => {
    let seen: Record<string, string> = {};
    const capture: Transport = async (req) => {
      seen = req.headers;
      return { status: 200, headers: {}, body: "" };
    };
    await safeFetch("https://leetcode.com/a", { allowedHosts: hosts, headers: { Cookie: "a=b", Authorization: "x", accept: "y" } }, capture);
    expect(seen).toEqual({ accept: "y" });
  });
});

describe("previewLeetCodeImport", () => {
  const graphql = (body: unknown, status = 200): Fetcher => async (url) =>
    url.endsWith("/graphql") ? { status, headers: {}, url, body: JSON.stringify(body) } : { status: 500, headers: {}, url, body: "" };

  it("returns an editable preview for a public problem", async () => {
    const r = await previewLeetCodeImport("https://leetcode.com/problems/pair-target-indices/", graphql({ data: { question: MOCK_QUESTION } }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.title).toBe("Pair Target Indices");
  });

  it("rejects non-LeetCode URLs without fetching", async () => {
    let called = false;
    const r = await previewLeetCodeImport("http://localhost:3000/problems/x", async () => {
      called = true;
      throw new Error("should not fetch");
    });
    expect(r).toMatchObject({ ok: false, reason: "invalid_url" });
    expect(called).toBe(false);
  });

  it("reports not found, premium, blocked, timeout and oversized responses honestly", async () => {
    const url = "https://leetcode.com/problems/x/";
    expect(await previewLeetCodeImport(url, graphql({ data: { question: null } }))).toMatchObject({ ok: false, reason: "not_found" });
    expect(
      await previewLeetCodeImport(url, graphql({ data: { question: { title: "P", content: null, isPaidOnly: true } } })),
    ).toMatchObject({ ok: false, reason: "premium" });
    expect(await previewLeetCodeImport(url, async (u) => ({ status: 403, headers: {}, url: u, body: "Just a moment..." }))).toMatchObject({
      ok: false,
      reason: "blocked",
    });
    expect(
      await previewLeetCodeImport(url, async () => {
        throw new SafeFetchError("timeout", "slow");
      }),
    ).toMatchObject({ ok: false, reason: "timeout", canonicalUrl: url });
    expect(
      await previewLeetCodeImport(url, async () => {
        throw new SafeFetchError("too_large", "big");
      }),
    ).toMatchObject({ ok: false, reason: "too_large" });
  });

  it("falls back to page data when GraphQL fails", async () => {
    const page = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ q: { ...MOCK_QUESTION, titleSlug: "x" } }).replace(/</g, "\\u003c")}</script>`;
    const r = await previewLeetCodeImport("https://leetcode.com/problems/x/", async (u) =>
      u.endsWith("/graphql") ? { status: 500, headers: {}, url: u, body: "oops" } : { status: 200, headers: {}, url: u, body: page },
    );
    expect(r).toMatchObject({ ok: true, via: "page" });
  });
});
