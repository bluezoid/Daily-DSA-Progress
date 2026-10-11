// Pure URL helpers for the LeetCode importer (safe for client and server).

export const LEETCODE_HOSTS = new Set(["leetcode.com", "www.leetcode.com"]);

export interface ParsedLeetCodeUrl {
  slug: string;
  canonicalUrl: string;
}

/** Accepts https://leetcode.com/problems/<slug>/... ; returns null for anything else. */
export function parseLeetCodeUrl(input: string): ParsedLeetCodeUrl | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password || url.port) return null;
  if (!LEETCODE_HOSTS.has(url.hostname.toLowerCase())) return null;
  const m = /^\/problems\/([a-z0-9]+(?:-[a-z0-9]+)*)(?:\/.*)?$/i.exec(url.pathname);
  if (!m || m[1].length > 120) return null;
  const slug = m[1].toLowerCase();
  return { slug, canonicalUrl: `https://leetcode.com/problems/${slug}/` };
}

/**
 * Normalizes any source URL for duplicate detection: LeetCode problem URLs map to
 * their canonical form; other URLs drop the hash, "www.", and trailing slash.
 */
export function canonicalizeSourceUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  const lc = parseLeetCodeUrl(input);
  if (lc) return lc.canonicalUrl;
  try {
    const u = new URL(input.trim());
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    const path = u.pathname.replace(/\/+$/, "");
    return `${u.protocol}//${host}${u.port ? `:${u.port}` : ""}${path}${u.search}`;
  } catch {
    return null;
  }
}
