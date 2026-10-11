export type ErrorCode =
  | "BAD_REQUEST"
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "DUPLICATE"
  | "RATE_LIMITED"
  | "PAYLOAD_TOO_LARGE"
  | "UPSTREAM_ERROR"
  | "INTERNAL_ERROR";

const STATUS: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION_ERROR: 422,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  DUPLICATE: 409,
  RATE_LIMITED: 429,
  PAYLOAD_TOO_LARGE: 413,
  UPSTREAM_ERROR: 502,
  INTERNAL_ERROR: 500,
};

/** An error whose message is safe to show to the client. */
export class ApiError extends Error {
  readonly status: number;
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: { fields?: Record<string, string[]>; [key: string]: unknown },
  ) {
    super(message);
    this.status = STATUS[code];
  }
}

export const notFound = (what = "Resource") => new ApiError("NOT_FOUND", `${what} not found`);
export const unauthorized = () => new ApiError("UNAUTHORIZED", "You need to sign in to continue");
