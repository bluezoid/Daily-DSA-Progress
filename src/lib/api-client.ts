// Browser-side helper for calling our JSON API.

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly fields: Record<string, string[]> = {},
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    method: init.method ?? "GET",
    headers: init.body !== undefined ? { "content-type": "application/json" } : undefined,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    credentials: "same-origin",
    cache: "no-store",
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON error page */
  }
  if (!res.ok) {
    const err = (data as { error?: { message?: string; code?: string; fields?: Record<string, string[]> } })?.error;
    const { message, code, fields, ...details } = err ?? {};
    throw new ApiClientError(
      message ?? (res.status === 429 ? "Too many requests. Please wait a moment." : "Something went wrong. Please try again."),
      res.status,
      code ?? "UNKNOWN",
      fields ?? {},
      details,
    );
  }
  return data as T;
}

export const errorMessage = (err: unknown) =>
  err instanceof ApiClientError ? err.message : "Network error. Check your connection and try again.";
