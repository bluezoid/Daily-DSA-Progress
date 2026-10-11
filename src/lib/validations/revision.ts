import { z } from "zod";
import { OUTCOMES, QUEUE_SORTS } from "@/lib/constants";
import { objectIdString } from "@/lib/utils/objectid";

export const createRevisionSchema = z.object({
  solutionVersionId: objectIdString,
  outcome: z.enum(OUTCOMES),
  confidence: z
    .number({ error: "Confidence is required" })
    .int("Confidence must be a whole number")
    .min(1, "Confidence must be between 1 and 5")
    .max(5, "Confidence must be between 1 and 5"),
  usedHints: z.boolean().default(false),
  viewedSolution: z.boolean().default(false),
  notes: z.string().max(5_000).default(""),
  // Only meaningful for viewed_solution / unable_to_solve; defaults to restarting.
  restartSchedule: z.boolean().default(true),
  mode: z.enum(["scheduled", "manual"]).default("manual"),
});

export type CreateRevisionInput = z.infer<typeof createRevisionSchema>;

export const queueQuerySchema = z.object({
  sort: z.enum(QUEUE_SORTS).catch("most_overdue"),
  upcomingDays: z.coerce.number().int().min(1).max(60).catch(14),
});

export const historyQuerySchema = z.object({
  solutionVersionId: objectIdString.optional(),
  problemId: objectIdString.optional(),
  limit: z.coerce.number().int().min(1).max(100).catch(50),
});
