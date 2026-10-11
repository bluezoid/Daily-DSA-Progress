// Shared between server pages and the client form (no "use client").
import type { Difficulty, ProblemStatus, SourceType } from "@/lib/constants";
import type { ProblemDTO, ProblemExample, ProblemImage, StatementFormat } from "@/types/domain";
import type { SolutionValues } from "@/components/solutions/solution-fields";

export const emptySolution: SolutionValues = {
  programmingLanguage: "python",
  label: "",
  code: "",
  approach: "",
  timeComplexity: "",
  spaceComplexity: "",
  personalNotes: "",
};

export interface ProblemFormValues {
  title: string;
  sourceType: SourceType;
  sourceName: string;
  sourceUrl: string;
  problemNumber: string;
  sourceProblemId: string;
  slug: string;
  difficulty: Difficulty;
  status: ProblemStatus;
  priority: string; // "" = unranked
  topics: string;
  statement: string;
  statementFormat: StatementFormat;
  examples: ProblemExample[];
  constraints: string;
  followUps: string;
  similarProblems: string;
  images: ProblemImage[];
  personalNotes: string;
  includeSolution: boolean;
  solution: SolutionValues;
}

export const FIELD_LABELS: Record<string, string> = {
  title: "Title",
  problemNumber: "Problem number",
  difficulty: "Difficulty",
  statement: "Statement",
  examples: "Examples",
  constraints: "Constraints",
  followUps: "Follow-ups",
  topics: "Topics",
  similarProblems: "Similar problems",
  images: "Images",
};

export function problemToFormValues(p: Partial<ProblemDTO>): ProblemFormValues {
  return {
    title: p.title ?? "",
    sourceType: p.sourceType ?? "personal",
    sourceName: p.sourceType === "other" ? (p.sourceName ?? "") : "",
    sourceUrl: p.sourceUrl ?? "",
    problemNumber: p.problemNumber ?? "",
    sourceProblemId: p.sourceProblemId ?? "",
    slug: p.slug ?? "",
    difficulty: p.difficulty ?? "unknown",
    status: p.status ?? "todo",
    priority: p.priorityScore != null ? String(p.priorityScore) : "",
    topics: (p.topics ?? []).join(", "),
    statement: p.statement ?? "",
    statementFormat: p.statementFormat ?? "markdown",
    examples: p.examples ?? [],
    constraints: (p.constraints ?? []).join("\n"),
    followUps: (p.followUps ?? []).join("\n"),
    similarProblems: (p.similarProblems ?? []).join("\n"),
    images: p.images ?? [],
    personalNotes: p.personalNotes ?? "",
    includeSolution: false,
    solution: emptySolution,
  };
}

