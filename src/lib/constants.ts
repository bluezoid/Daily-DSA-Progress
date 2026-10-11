// Shared enumerations and labels. Safe to import from client and server code.

export const APP_NAME = "Daily DSA Progress";

export const SOURCE_TYPES = [
  "leetcode",
  "hackerrank",
  "codeforces",
  "geeksforgeeks",
  "interview",
  "book",
  "tutorial",
  "personal",
  "other",
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const SOURCE_LABELS: Record<SourceType, string> = {
  leetcode: "LeetCode",
  hackerrank: "HackerRank",
  codeforces: "Codeforces",
  geeksforgeeks: "GeeksforGeeks",
  interview: "Interview",
  book: "Book",
  tutorial: "Tutorial",
  personal: "Personal",
  other: "Other",
};

export const DIFFICULTIES = ["easy", "medium", "hard", "unknown"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];
export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  unknown: "Unknown",
};
export const DIFFICULTY_RANK: Record<Difficulty, number> = { unknown: 0, easy: 1, medium: 2, hard: 3 };

export const STATUSES = ["todo", "attempted", "solved", "needs_revision"] as const;
export type ProblemStatus = (typeof STATUSES)[number];
export const STATUS_LABELS: Record<ProblemStatus, string> = {
  todo: "Todo",
  attempted: "Attempted",
  solved: "Solved",
  needs_revision: "Needs Revision",
};
export const STATUS_RANK: Record<ProblemStatus, number> = {
  todo: 0,
  attempted: 1,
  needs_revision: 2,
  solved: 3,
};

export const LANGUAGES = [
  "python",
  "javascript",
  "typescript",
  "java",
  "cpp",
  "c",
  "go",
  "rust",
  "other",
] as const;
export type Language = (typeof LANGUAGES)[number];
export const LANGUAGE_LABELS: Record<Language, string> = {
  python: "Python",
  javascript: "JavaScript",
  typescript: "TypeScript",
  java: "Java",
  cpp: "C++",
  c: "C",
  go: "Go",
  rust: "Rust",
  other: "Other",
};

export const OUTCOMES = [
  "solved_independently",
  "solved_with_hints",
  "viewed_solution",
  "unable_to_solve",
] as const;
export type RevisionOutcome = (typeof OUTCOMES)[number];
export const OUTCOME_LABELS: Record<RevisionOutcome, string> = {
  solved_independently: "Solved independently",
  solved_with_hints: "Solved with hints",
  viewed_solution: "Viewed the solution",
  unable_to_solve: "Unable to solve",
};

export const PRIORITY_BANDS = ["low", "medium", "high", "unranked"] as const;
export type PriorityBand = (typeof PRIORITY_BANDS)[number];
export const PRIORITY_BAND_RANGES: Record<Exclude<PriorityBand, "unranked">, [number, number]> = {
  low: [1, 3],
  medium: [4, 7],
  high: [8, 10],
};

export function priorityBand(score: number | null | undefined): PriorityBand {
  if (score == null) return "unranked";
  if (score <= 3) return "low";
  if (score <= 7) return "medium";
  return "high";
}

export const REVISION_STATUSES = [
  "overdue",
  "due_today",
  "upcoming",
  "never_revised",
  "not_scheduled",
] as const;
export type RevisionStatus = (typeof REVISION_STATUSES)[number];
export const REVISION_STATUS_LABELS: Record<RevisionStatus, string> = {
  overdue: "Overdue",
  due_today: "Due today",
  upcoming: "Upcoming",
  never_revised: "Never revised",
  not_scheduled: "Not scheduled",
};

export const SORT_OPTIONS = [
  "created_desc",
  "created_asc",
  "updated_desc",
  "priority_desc",
  "priority_asc",
  "difficulty_asc",
  "difficulty_desc",
  "title_asc",
  "title_desc",
  "revised_desc",
  "next_revision_asc",
  "solutions_desc",
  "status_asc",
] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];
export const SORT_LABELS: Record<SortOption, string> = {
  created_desc: "Newest first",
  created_asc: "Oldest first",
  updated_desc: "Recently updated",
  priority_desc: "Priority: highest first",
  priority_asc: "Priority: lowest first",
  difficulty_asc: "Difficulty: easy → hard",
  difficulty_desc: "Difficulty: hard → easy",
  title_asc: "Title A → Z",
  title_desc: "Title Z → A",
  revised_desc: "Recently revised",
  next_revision_asc: "Next revision date",
  solutions_desc: "Most solutions",
  status_asc: "Status",
};

export const QUEUE_SORTS = ["most_overdue", "priority", "difficulty", "next_date", "recent"] as const;
export type QueueSort = (typeof QUEUE_SORTS)[number];
export const QUEUE_SORT_LABELS: Record<QueueSort, string> = {
  most_overdue: "Most overdue",
  priority: "Highest priority",
  difficulty: "Difficulty",
  next_date: "Next scheduled date",
  recent: "Recently added",
};

export const SESSION_COOKIE = "dsa_session";
