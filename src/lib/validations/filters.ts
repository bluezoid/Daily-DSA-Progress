import { z } from "zod";
import {
  DIFFICULTIES,
  LANGUAGES,
  PRIORITY_BANDS,
  REVISION_STATUSES,
  SORT_OPTIONS,
  SOURCE_TYPES,
  STATUSES,
} from "@/lib/constants";

type RawParams = URLSearchParams | Record<string, string | string[] | undefined>;

/** Comma-separated (or repeated) values, filtered to an allowlist. Unknown values are dropped. */
const multi = <T extends string>(allowed: readonly T[]) =>
  z
    .array(z.string())
    .default([])
    .transform((values) => {
      const set = new Set<T>();
      for (const v of values.flatMap((x) => x.split(","))) {
        const t = v.trim() as T;
        if ((allowed as readonly string[]).includes(t)) set.add(t);
      }
      return [...set];
    });

const freeMulti = (maxItems: number, maxLen: number) =>
  z
    .array(z.string())
    .default([])
    .transform((values) => [
      ...new Set(
        values
          .flatMap((x) => x.split(","))
          .map((x) => x.trim())
          .filter((x) => x.length > 0 && x.length <= maxLen),
      ),
    ].slice(0, maxItems));

const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .catch(undefined);

const priorityNum = z.coerce.number().int().min(1).max(10).optional().catch(undefined);

const boolFlag = z
  .string()
  .optional()
  .transform((v) => v === "1" || v === "true");

export const problemFiltersSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  source: multi(SOURCE_TYPES),
  sourceName: z.string().trim().max(100).optional().catch(undefined),
  difficulty: multi(DIFFICULTIES),
  status: multi(STATUSES),
  priorityMin: priorityNum,
  priorityMax: priorityNum,
  priorityBand: multi(PRIORITY_BANDS),
  topics: freeMulti(20, 50),
  topicMode: z.enum(["any", "all"]).catch("any"),
  solutions: z.enum(["none", "any", "multiple"]).optional().catch(undefined),
  preferred: boolFlag,
  language: multi(LANGUAGES),
  revision: multi(REVISION_STATUSES),
  createdFrom: dateStr,
  createdTo: dateStr,
  updatedFrom: dateStr,
  updatedTo: dateStr,
  revisedFrom: dateStr,
  revisedTo: dateStr,
  nextFrom: dateStr,
  nextTo: dateStr,
  sort: z.enum(SORT_OPTIONS).catch("created_desc"),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
  pageSize: z.coerce.number().int().min(1).max(50).catch(20),
});

export type ProblemFilters = z.infer<typeof problemFiltersSchema>;

const MULTI_KEYS = new Set(["source", "difficulty", "status", "priorityBand", "topics", "language", "revision"]);

/**
 * Converts raw query params into validated filters. Only string values are read,
 * so objects such as `{ $gt: "" }` can never reach a database query.
 */
export function parseProblemFilters(raw: RawParams): ProblemFilters {
  const obj: Record<string, unknown> = {};
  const add = (key: string, value: string) => {
    if (MULTI_KEYS.has(key)) {
      const list = (obj[key] as string[] | undefined) ?? [];
      list.push(value);
      obj[key] = list;
    } else if (obj[key] === undefined) {
      obj[key] = value;
    }
  };
  if (raw instanceof URLSearchParams) {
    raw.forEach((value, key) => add(key, value));
  } else {
    for (const [key, value] of Object.entries(raw)) {
      if (typeof value === "string") add(key, value);
      else if (Array.isArray(value)) value.filter((v) => typeof v === "string").forEach((v) => add(key, v));
    }
  }
  for (const key of Object.keys(obj)) if (obj[key] === "") delete obj[key];
  return problemFiltersSchema.parse(obj);
}

/** Serializes filters back to URL params, omitting defaults. */
export function filtersToSearchParams(f: Partial<ProblemFilters>): URLSearchParams {
  const p = new URLSearchParams();
  for (const [key, value] of Object.entries(f)) {
    if (value === undefined || value === null || value === false || value === "") continue;
    if (Array.isArray(value)) {
      if (value.length) p.set(key, value.join(","));
    } else if (key === "sort" && value === "created_desc") continue;
    else if (key === "page" && value === 1) continue;
    else if (key === "pageSize" && value === 20) continue;
    else if (key === "topicMode" && value === "any") continue;
    else if (value === true) p.set(key, "1");
    else p.set(key, String(value));
  }
  return p;
}

/** Number of active filter conditions (search and sort excluded). */
export function activeFilterCount(f: ProblemFilters) {
  let n = 0;
  for (const k of ["source", "difficulty", "status", "priorityBand", "topics", "language", "revision"] as const) n += f[k].length;
  for (const k of ["sourceName", "priorityMin", "priorityMax", "solutions", "createdFrom", "createdTo", "updatedFrom", "updatedTo", "revisedFrom", "revisedTo", "nextFrom", "nextTo"] as const)
    if (f[k] !== undefined) n++;
  if (f.preferred) n++;
  return n;
}
