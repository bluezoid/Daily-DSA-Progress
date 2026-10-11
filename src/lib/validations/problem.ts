import { z } from "zod";
import { DIFFICULTIES, SOURCE_TYPES, STATUSES } from "@/lib/constants";
import { createSolutionSchema } from "./solution";

const httpUrl = z
  .string()
  .trim()
  .max(2048, "URL is too long")
  .refine((v) => {
    try {
      const u = new URL(v);
      return u.protocol === "https:" || u.protocol === "http:";
    } catch {
      return false;
    }
  }, "Enter a valid http(s) URL");

const optionalUrl = z
  .union([httpUrl, z.literal(""), z.null()])
  .transform((v) => (v ? v : null));

const nullableShort = (max: number) =>
  z
    .union([z.string().trim().max(max), z.null()])
    .transform((v) => (v ? v : null));

const cleanList = (maxItems: number, maxLen: number) =>
  z
    .array(z.string().trim().max(maxLen))
    .max(maxItems)
    .transform((list) => list.filter(Boolean));

export const priorityScoreSchema = z
  .number({ error: "Priority must be a number" })
  .int("Priority must be a whole number")
  .min(1, "Priority must be between 1 and 10")
  .max(10, "Priority must be between 1 and 10")
  .nullable();

export const topicsSchema = z
  .array(z.string().trim().min(1).max(50, "Topic names are limited to 50 characters"))
  .max(30, "At most 30 topics")
  .transform((topics) => {
    const seen = new Set<string>();
    return topics.filter((t) => {
      const k = t.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  });

export const exampleSchema = z.object({
  input: z.string().max(5_000).default(""),
  output: z.string().max(5_000).default(""),
  explanation: z.string().max(5_000).default(""),
});

export const imageSchema = z.object({
  url: z
    .string()
    .max(2048)
    .refine((v) => {
      try {
        return new URL(v).protocol === "https:";
      } catch {
        return false;
      }
    }, "Image URLs must use https"),
  alt: z.string().max(300).default(""),
});

const problemFields = {
  title: z.string().trim().min(1, "Title is required").max(300, "Title is too long"),
  sourceType: z.enum(SOURCE_TYPES).default("personal"),
  sourceName: z.string().trim().max(100, "Source name is too long").default(""),
  sourceUrl: optionalUrl.default(null),
  problemNumber: nullableShort(20).default(null),
  sourceProblemId: nullableShort(100).default(null),
  slug: nullableShort(200).default(null),
  difficulty: z.enum(DIFFICULTIES).default("unknown"),
  statement: z.string().max(100_000, "Statement is too long").default(""),
  statementFormat: z.enum(["markdown", "html"]).default("markdown"),
  examples: z.array(exampleSchema).max(30).default([]),
  constraints: cleanList(50, 1_000).default([]),
  followUps: cleanList(20, 2_000).default([]),
  topics: topicsSchema.default([]),
  similarProblems: cleanList(50, 200).default([]),
  images: z.array(imageSchema).max(30).default([]),
  status: z.enum(STATUSES).default("todo"),
  priorityScore: priorityScoreSchema.default(null),
  personalNotes: z.string().max(20_000).default(""),
};

export const createProblemSchema = z
  .object({
    ...problemFields,
    initialSolution: createSolutionSchema.nullish(),
    allowDuplicate: z.boolean().default(false),
    importMeta: z
      .object({ missingFields: z.array(z.string().max(40)).max(20).default([]) })
      .nullish(),
  })
  .superRefine((v, ctx) => {
    if (v.sourceType === "other" && !v.sourceName) {
      ctx.addIssue({ code: "custom", path: ["sourceName"], message: "Enter a name for the custom source" });
    }
  });

export const updateProblemSchema = z
  .object({
    title: problemFields.title.optional(),
    sourceType: z.enum(SOURCE_TYPES).optional(),
    sourceName: z.string().trim().max(100).optional(),
    sourceUrl: optionalUrl.optional(),
    problemNumber: nullableShort(20).optional(),
    sourceProblemId: nullableShort(100).optional(),
    slug: nullableShort(200).optional(),
    difficulty: z.enum(DIFFICULTIES).optional(),
    statement: z.string().max(100_000).optional(),
    statementFormat: z.enum(["markdown", "html"]).optional(),
    examples: z.array(exampleSchema).max(30).optional(),
    constraints: cleanList(50, 1_000).optional(),
    followUps: cleanList(20, 2_000).optional(),
    topics: topicsSchema.optional(),
    similarProblems: cleanList(50, 200).optional(),
    images: z.array(imageSchema).max(30).optional(),
    status: z.enum(STATUSES).optional(),
    priorityScore: priorityScoreSchema.optional(),
    personalNotes: z.string().max(20_000).optional(),
  })
  .strict();

export type CreateProblemInput = z.infer<typeof createProblemSchema>;
export type UpdateProblemInput = z.infer<typeof updateProblemSchema>;
