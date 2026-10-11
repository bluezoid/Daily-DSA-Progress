import "server-only";
import { ObjectId } from "mongodb";
import { DIFFICULTY_RANK, SOURCE_LABELS, STATUS_RANK } from "@/lib/constants";
import { ApiError, notFound } from "@/lib/http/errors";
import { withTransaction } from "@/lib/mongodb/collections";
import { htmlToText, sanitizeStatementHtml } from "@/lib/sanitize";
import { toObjectId } from "@/lib/utils/objectid";
import type { AuthUser } from "@/lib/auth/session";
import type { CreateProblemInput, UpdateProblemInput } from "@/lib/validations/problem";
import type { ProblemFilters } from "@/lib/validations/filters";
import type { Paginated, ProblemDoc, SolutionVersionDoc, StatementFormat } from "@/types/domain";
import {
  aggregateProblems,
  deleteProblemDoc,
  findProblem,
  findProblemByCanonicalUrl,
  insertProblem,
  updateProblemFields,
} from "@/repositories/problems.repository";
import { deleteSolutionsForProblem } from "@/repositories/solutions.repository";
import { deleteRevisionsForProblem } from "@/repositories/revisions.repository";
import { canonicalizeSourceUrl, parseLeetCodeUrl } from "@/services/leetcode/url";
import { buildSolutionDoc, insertSolutionInTx } from "@/services/solutions/solution.service";
import { buildProblemListPipeline } from "./query-builder";

/** Statement is sanitized on every write, so the database never holds unsafe HTML. */
function normalizeStatement(statement: string, format: StatementFormat) {
  if (format === "html") {
    const clean = sanitizeStatementHtml(statement);
    return { statement: clean, statementText: htmlToText(clean).slice(0, 20_000) };
  }
  return { statement, statementText: statement.replace(/\s+/g, " ").trim().slice(0, 20_000) };
}

function resolveSourceName(sourceType: ProblemDoc["sourceType"], sourceName: string) {
  return sourceName || SOURCE_LABELS[sourceType];
}

export async function findDuplicate(user: AuthUser, sourceUrl: string | null) {
  const canonicalUrl = canonicalizeSourceUrl(sourceUrl);
  if (!canonicalUrl) return null;
  const existing = await findProblemByCanonicalUrl(user.id, canonicalUrl);
  return existing ? { id: existing._id.toHexString(), title: existing.title } : null;
}

export async function createProblem(user: AuthUser, input: CreateProblemInput, now = new Date()) {
  const canonicalUrl = canonicalizeSourceUrl(input.sourceUrl);
  if (canonicalUrl && !input.allowDuplicate) {
    const existing = await findProblemByCanonicalUrl(user.id, canonicalUrl);
    if (existing) {
      throw new ApiError("DUPLICATE", "You already saved a problem with this URL.", {
        existingId: existing._id.toHexString(),
        existingTitle: existing.title,
      });
    }
  }

  const lc = input.sourceUrl ? parseLeetCodeUrl(input.sourceUrl) : null;
  const doc: ProblemDoc = {
    _id: new ObjectId(),
    userId: user.id,
    title: input.title,
    titleLower: input.title.toLowerCase(),
    slug: input.slug ?? lc?.slug ?? null,
    problemNumber: input.problemNumber,
    sourceType: input.sourceType,
    sourceName: resolveSourceName(input.sourceType, input.sourceName),
    sourceUrl: input.sourceUrl,
    canonicalUrl,
    sourceProblemId: input.sourceProblemId,
    difficulty: input.difficulty,
    difficultyRank: DIFFICULTY_RANK[input.difficulty],
    ...normalizeStatement(input.statement, input.statementFormat),
    statementFormat: input.statementFormat,
    examples: input.examples,
    constraints: input.constraints,
    followUps: input.followUps,
    topics: input.topics,
    similarProblems: input.similarProblems,
    images: input.images,
    status: input.status,
    statusRank: STATUS_RANK[input.status],
    priorityScore: input.priorityScore,
    personalNotes: input.personalNotes,
    importedAt: input.importMeta ? now : null,
    importMissingFields: input.importMeta?.missingFields ?? [],
    solutionCount: 0,
    languages: [],
    hasPreferred: false,
    nextRevisionAt: null,
    lastRevisedAt: null,
    neverRevisedCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  return withTransaction(async (session) => {
    await insertProblem(doc, session);
    let solution: SolutionVersionDoc | null = null;
    if (input.initialSolution) {
      solution = await insertSolutionInTx(buildSolutionDoc(user, doc._id, input.initialSolution, now), session);
    }
    const saved = (await findProblem(user.id, doc._id, session))!;
    return { problem: saved, solution };
  });
}

export async function getProblem(user: AuthUser, idRaw: string) {
  const id = toObjectId(idRaw);
  const problem = id ? await findProblem(user.id, id) : null;
  if (!problem) throw notFound("Problem");
  return problem;
}

export async function updateProblem(user: AuthUser, idRaw: string, input: UpdateProblemInput, now = new Date()) {
  const id = toObjectId(idRaw);
  if (!id) throw notFound("Problem");
  const existing = await findProblem(user.id, id);
  if (!existing) throw notFound("Problem");

  const { statement, statementFormat, ...rest } = input;
  const set: Partial<ProblemDoc> = { ...rest, updatedAt: now };

  if (input.title !== undefined) set.titleLower = input.title.toLowerCase();
  if (input.difficulty !== undefined) set.difficultyRank = DIFFICULTY_RANK[input.difficulty];
  if (input.status !== undefined) set.statusRank = STATUS_RANK[input.status];

  const sourceType = input.sourceType ?? existing.sourceType;
  if (input.sourceType !== undefined || input.sourceName !== undefined) {
    const name = input.sourceName ?? existing.sourceName;
    if (sourceType === "other" && !name) {
      throw new ApiError("VALIDATION_ERROR", "Some fields are invalid", {
        fields: { sourceName: ["Enter a name for the custom source"] },
      });
    }
    // Switching type keeps a custom name only if it was not the previous default label.
    const wasDefault = existing.sourceName === SOURCE_LABELS[existing.sourceType];
    set.sourceName =
      input.sourceName !== undefined
        ? resolveSourceName(sourceType, input.sourceName)
        : wasDefault
          ? SOURCE_LABELS[sourceType]
          : existing.sourceName;
  }
  if (input.sourceUrl !== undefined) set.canonicalUrl = canonicalizeSourceUrl(input.sourceUrl);

  if (statement !== undefined || statementFormat !== undefined) {
    const format = statementFormat ?? existing.statementFormat;
    Object.assign(set, normalizeStatement(statement ?? existing.statement, format), { statementFormat: format });
  }

  const updated = await updateProblemFields(user.id, id, set);
  if (!updated) throw notFound("Problem");
  return updated;
}

/** Deletes the problem with its versions and revision history, atomically. */
export async function deleteProblem(user: AuthUser, idRaw: string) {
  const id = toObjectId(idRaw);
  if (!id) throw notFound("Problem");
  await withTransaction(async (session) => {
    const deleted = await deleteProblemDoc(user.id, id, session);
    if (!deleted) throw notFound("Problem");
    await deleteSolutionsForProblem(user.id, id, session);
    await deleteRevisionsForProblem(user.id, id, session);
  });
}

export async function listProblems(
  user: AuthUser,
  filters: ProblemFilters,
  now = new Date(),
): Promise<Paginated<ProblemDoc>> {
  const pipeline = buildProblemListPipeline(user.id, filters, { now, timezone: user.timezone });
  const [res] = await aggregateProblems<{ items: ProblemDoc[]; total: { n: number }[] }>(user.id, pipeline);
  const total = res?.total[0]?.n ?? 0;
  return {
    items: res?.items ?? [],
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
  };
}

/** Distinct topics and custom source names for filter suggestions. */
export async function getFilterFacets(user: AuthUser) {
  const [res] = await aggregateProblems<{ topics: string[]; sourceNames: string[] }>(user.id, [
    { $match: { userId: user.id } },
    {
      $facet: {
        topics: [{ $unwind: "$topics" }, { $group: { _id: "$topics" } }, { $sort: { _id: 1 } }, { $limit: 200 }],
        sourceNames: [{ $group: { _id: "$sourceName" } }, { $sort: { _id: 1 } }, { $limit: 100 }],
      },
    },
    {
      $project: {
        topics: { $map: { input: "$topics", in: "$$this._id" } },
        sourceNames: { $map: { input: "$sourceNames", in: "$$this._id" } },
      },
    },
  ]);
  return { topics: res?.topics ?? [], sourceNames: res?.sourceNames ?? [] };
}
