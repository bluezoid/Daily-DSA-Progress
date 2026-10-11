import type { ObjectId } from "mongodb";
import type {
  Difficulty,
  Language,
  ProblemStatus,
  RevisionOutcome,
  SourceType,
} from "@/lib/constants";

// ---- Database documents (server only) ----

export interface UserDoc {
  _id: ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  timezone: string;
  tokenVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProblemImage {
  url: string;
  alt: string;
  /** Display width in px from the source, when known. */
  width?: number;
}

export interface ProblemExample {
  input: string;
  output: string;
  explanation: string;
  /** Illustrations belonging to this example (absent on records saved before this field existed). */
  images?: ProblemImage[];
}

export type StatementFormat = "markdown" | "html";

export interface ProblemDoc {
  _id: ObjectId;
  userId: ObjectId;
  title: string;
  titleLower: string;
  slug: string | null;
  problemNumber: string | null;
  sourceType: SourceType;
  sourceName: string;
  sourceUrl: string | null;
  canonicalUrl: string | null;
  sourceProblemId: string | null;
  difficulty: Difficulty;
  difficultyRank: number;
  statement: string;
  statementFormat: StatementFormat;
  statementText: string;
  examples: ProblemExample[];
  constraints: string[];
  followUps: string[];
  topics: string[];
  similarProblems: string[];
  images: ProblemImage[];
  status: ProblemStatus;
  statusRank: number;
  priorityScore: number | null;
  personalNotes: string;
  importedAt: Date | null;
  importMissingFields: string[];
  // Denormalized from solutionVersions; written only by recomputeProblemSummary.
  solutionCount: number;
  languages: Language[];
  hasPreferred: boolean;
  nextRevisionAt: Date | null;
  lastRevisedAt: Date | null;
  neverRevisedCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SolutionVersionDoc {
  _id: ObjectId;
  userId: ObjectId;
  problemId: ObjectId;
  label: string;
  code: string;
  programmingLanguage: Language;
  approach: string;
  timeComplexity: string;
  spaceComplexity: string;
  personalNotes: string;
  isPreferred: boolean;
  stage: number;
  revisionCount: number;
  lastRevisedAt: Date | null;
  nextRevisionAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RevisionSessionDoc {
  _id: ObjectId;
  userId: ObjectId;
  problemId: ObjectId;
  solutionVersionId: ObjectId;
  revisedAt: Date;
  outcome: RevisionOutcome;
  confidence: number;
  usedHints: boolean;
  viewedSolution: boolean;
  restartedSchedule: boolean;
  notes: string;
  mode: "scheduled" | "manual";
  wasDue: boolean;
  stageBefore: number;
  stageAfter: number;
  previousNextRevisionAt: Date | null;
  nextRevisionAt: Date;
}

export interface RateLimitDoc {
  _id: string;
  count: number;
  expiresAt: Date;
}

// ---- API DTOs (safe to send to the browser; ids as strings) ----

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  timezone: string;
  createdAt: string;
}

export interface ProblemDTO {
  id: string;
  title: string;
  slug: string | null;
  problemNumber: string | null;
  sourceType: SourceType;
  sourceName: string;
  sourceUrl: string | null;
  sourceProblemId: string | null;
  difficulty: Difficulty;
  statement: string;
  statementFormat: StatementFormat;
  examples: ProblemExample[];
  constraints: string[];
  followUps: string[];
  topics: string[];
  similarProblems: string[];
  images: ProblemImage[];
  status: ProblemStatus;
  priorityScore: number | null;
  personalNotes: string;
  importedAt: string | null;
  solutionCount: number;
  languages: Language[];
  hasPreferred: boolean;
  nextRevisionAt: string | null;
  lastRevisedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ProblemListItemDTO = Omit<
  ProblemDTO,
  "statement" | "examples" | "constraints" | "followUps" | "images" | "similarProblems" | "personalNotes"
>;

export interface SolutionVersionDTO {
  id: string;
  problemId: string;
  label: string;
  code: string;
  programmingLanguage: Language;
  approach: string;
  timeComplexity: string;
  spaceComplexity: string;
  personalNotes: string;
  isPreferred: boolean;
  stage: number;
  revisionCount: number;
  lastRevisedAt: string | null;
  nextRevisionAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RevisionSessionDTO {
  id: string;
  problemId: string;
  solutionVersionId: string;
  revisedAt: string;
  outcome: RevisionOutcome;
  confidence: number;
  usedHints: boolean;
  viewedSolution: boolean;
  restartedSchedule: boolean;
  notes: string;
  mode: "scheduled" | "manual";
  wasDue: boolean;
  stageBefore: number;
  stageAfter: number;
  previousNextRevisionAt: string | null;
  nextRevisionAt: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
