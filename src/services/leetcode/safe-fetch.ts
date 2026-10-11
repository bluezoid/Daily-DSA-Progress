import "server-only";
import dns from "node:dns";
import https from "node:https";
import net from "node:net";

/**
 * Minimal SSRF-hardened HTTPS client for the importer:
 * - https only, explicit host allowlist checked on the first URL and every redirect;
 * - DNS answers are checked at connect time (the socket's own lookup), so a
 *   rebinding DNS server cannot swap in a private address after validation;
 * - no cookies or credentials are ever sent; overall timeout; response size cap.
 */

export type SafeFetchErrorKind =
  | "blocked_host"
  | "private_address"
  | "timeout"
  | "too_large"
  | "too_many_redirects"
  | "network";

export class SafeFetchError extends Error {
  constructor(
    readonly kind: SafeFetchErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "SafeFetchError";
  }
}

export interface SafeFetchOptions {
  allowedHosts: ReadonlySet<string>;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
}

export interface SafeResponse {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
  url: string;
}

export interface TransportRequest {
  url: URL;
  method: "GET" | "POST";
  headers: Record<string, string>;
  body?: string;
  timeoutMs: number;
  maxBytes: number;
}

export type Transport = (req: TransportRequest) => Promise<Omit<SafeResponse, "url">>;

const blockList = new net.BlockList();
for (const [addr, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blockList.addSubnet(addr, prefix, "ipv4");
}
for (const [addr, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["100::", 64],
  ["2001:db8::", 32],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blockList.addSubnet(addr, prefix, "ipv6");
}

/** True for loopback, private, link-local, CGNAT, multicast, reserved and documentation ranges. */
export function isPrivateAddress(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) return blockList.check(ip, "ipv4");
  if (family === 6) {
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
    if (mapped) return blockList.check(mapped[1], "ipv4");
    return blockList.check(ip, "ipv6");
  }
  return true; // not an IP at all: treat as unsafe
}

type LookupAddress = { address: string; family: number };

/** dns.lookup replacement used by the socket itself; rejects any private answer. */
export function guardedLookup(
  hostname: string,
  options: dns.LookupOptions,
  callback: (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void,
) {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "", 0);
    const list = addresses as LookupAddress[];
    if (!list.length || list.some((a) => isPrivateAddress(a.address))) {
      return callback(
        Object.assign(new Error(`Refusing to connect to a private address for ${hostname}`), {
          code: "EPRIVATE",
        }),
        "",
        0,
      );
    }
    if (options.all) return callback(null, list);
    callback(null, list[0].address, list[0].family);
  });
}

export const httpsTransport: Transport = (req) =>
  new Promise((resolve, reject) => {
    const request = https.request(
      req.url,
      {
        method: req.method,
        headers: { ...req.headers, "accept-encoding": "identity" },
        lookup: guardedLookup as unknown as typeof dns.lookup,
        agent: false,
      },
      (res) => {
        const declared = Number(res.headers["content-length"] ?? 0);
        if (declared > req.maxBytes) {
          res.destroy();
          request.destroy();
          return reject(new SafeFetchError("too_large", "Response is too large"));
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > req.maxBytes) {
            res.destroy();
            request.destroy();
            reject(new SafeFetchError("too_large", "Response is too large"));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () =>
          resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks).toString("utf8") }),
        );
        res.on("error", (e) => reject(new SafeFetchError("network", e.message)));
      },
    );
    request.setTimeout(req.timeoutMs, () => {
      request.destroy();
      reject(new SafeFetchError("timeout", "The source took too long to respond"));
    });
    request.on("error", (e: NodeJS.ErrnoException) => {
      if (e.code === "EPRIVATE") reject(new SafeFetchError("private_address", "Destination is not allowed"));
      else reject(new SafeFetchError("network", "Could not reach the source"));
    });
    if (req.body) request.write(req.body);
    request.end();
  });

function assertAllowed(url: URL, allowedHosts: ReadonlySet<string>) {
  if (url.protocol !== "https:") throw new SafeFetchError("blocked_host", "Only https URLs are allowed");
  if (url.username || url.password || (url.port && url.port !== "443")) {
    throw new SafeFetchError("blocked_host", "URL is not allowed");
  }
  if (!allowedHosts.has(url.hostname.toLowerCase())) {
    throw new SafeFetchError("blocked_host", `Host ${url.hostname} is not allowed`);
  }
  if (net.isIP(url.hostname)) throw new SafeFetchError("blocked_host", "IP literals are not allowed");
}

export async function safeFetch(
  input: string,
  opts: SafeFetchOptions,
  transport: Transport = httpsTransport,
): Promise<SafeResponse> {
  const timeoutMs = opts.timeoutMs ?? 8_000;
  const maxBytes = opts.maxBytes ?? 2 * 1024 * 1024;
  const maxRedirects = opts.maxRedirects ?? 3;
  const deadline = Date.now() + timeoutMs;

  let url = new URL(input);
  let method = opts.method ?? "GET";
  let body = opts.body;

  for (let hop = 0; ; hop++) {
    assertAllowed(url, opts.allowedHosts);
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new SafeFetchError("timeout", "The source took too long to respond");

    // Only caller-provided headers; never cookies or authorization.
    const headers = Object.fromEntries(
      Object.entries(opts.headers ?? {}).filter(([k]) => !/^(cookie|authorization|proxy-authorization)$/i.test(k)),
    );
    const res = await transport({ url, method, headers, body, timeoutMs: remaining, maxBytes });

    if ([301, 302, 303, 307, 308].includes(res.status)) {
      if (hop >= maxRedirects) throw new SafeFetchError("too_many_redirects", "Too many redirects");
      const location = res.headers["location"];
      const loc = Array.isArray(location) ? location[0] : location;
      if (!loc) throw new SafeFetchError("network", "Redirect without a location");
      url = new URL(loc, url);
      if (res.status === 303 || ((res.status === 301 || res.status === 302) && method === "POST")) {
        method = "GET";
        body = undefined;
      }
      continue;
    }
    return { ...res, url: url.toString() };
  }
}
