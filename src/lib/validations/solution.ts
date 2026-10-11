import { z } from "zod";
import { LANGUAGES } from "@/lib/constants";

export const solutionFields = {
  label: z.string().trim().max(100, "Label is too long").default(""),
  programmingLanguage: z.enum(LANGUAGES),
  code: z.string().max(100_000, "Code is too long (100k characters max)").refine((c) => c.trim().length > 0, "Code is required"),
  approach: z.string().trim().max(5_000).default(""),
  timeComplexity: z.string().trim().max(100).default(""),
  spaceComplexity: z.string().trim().max(100).default(""),
  personalNotes: z.string().max(20_000).default(""),
};

export const createSolutionSchema = z.object({
  ...solutionFields,
  isPreferred: z.boolean().default(false),
});

export const updateSolutionSchema = z
  .object({
    label: solutionFields.label.optional(),
    programmingLanguage: solutionFields.programmingLanguage.optional(),
    code: solutionFields.code.optional(),
    approach: z.string().trim().max(5_000).optional(),
    timeComplexity: z.string().trim().max(100).optional(),
    spaceComplexity: z.string().trim().max(100).optional(),
    personalNotes: z.string().max(20_000).optional(),
  })
  .strict();

export type CreateSolutionInput = z.infer<typeof createSolutionSchema>;
export type UpdateSolutionInput = z.infer<typeof updateSolutionSchema>;
