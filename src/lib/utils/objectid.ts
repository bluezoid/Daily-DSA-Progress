import { ObjectId } from "mongodb";
import { z } from "zod";

export function isObjectIdString(value: unknown): value is string {
  return typeof value === "string" && /^[a-f\d]{24}$/i.test(value);
}

/** Parses a 24-hex id; returns null for anything else (callers turn this into a 404). */
export function toObjectId(value: unknown): ObjectId | null {
  return isObjectIdString(value) ? new ObjectId(value) : null;
}

export const objectIdString = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");
