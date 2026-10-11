import "server-only";
import { ObjectId, type ClientSession } from "mongodb";
import { LANGUAGE_LABELS } from "@/lib/constants";
import { ApiError, notFound } from "@/lib/http/errors";
import { withTransaction } from "@/lib/mongodb/collections";
import { toObjectId } from "@/lib/utils/objectid";
import type { AuthUser } from "@/lib/auth/session";
import type { CreateSolutionInput, UpdateSolutionInput } from "@/lib/validations/solution";
import type { SolutionVersionDoc } from "@/types/domain";
import { findProblem } from "@/repositories/problems.repository";
import {
  clearPreferred,
  deleteSolutionDoc,
  findSolution,
  insertSolution,
  listSolutionsForProblem,
  recomputeProblemSummary,
  updateSolutionFields,
} from "@/repositories/solutions.repository";
import { deleteRevisionsForVersion } from "@/repositories/revisions.repository";
import { initialSchedule } from "@/services/revisions/schedule";

function defaultLabel(input: Pick<CreateSolutionInput, "label" | "programmingLanguage" | "approach">) {
  if (input.label) return input.label;
  const lang = LANGUAGE_LABELS[input.programmingLanguage];
  const approach = input.approach.split("\n")[0].trim().slice(0, 60);
  return approach ? `${lang} — ${approach}` : lang;
}

/** Builds a new version document with the server-controlled schedule. */
export function buildSolutionDoc(
  user: AuthUser,
  problemId: ObjectId,
  input: CreateSolutionInput,
  now: Date,
): SolutionVersionDoc {
  const schedule = initialSchedule(now, user.timezone);
  return {
    _id: new ObjectId(),
    userId: user.id,
    problemId,
    label: defaultLabel(input),
    code: input.code,
    programmingLanguage: input.programmingLanguage,
    approach: input.approach,
    timeComplexity: input.timeComplexity,
    spaceComplexity: input.spaceComplexity,
    personalNotes: input.personalNotes,
    isPreferred: input.isPreferred,
    stage: schedule.stage,
    revisionCount: 0,
    lastRevisedAt: null,
    nextRevisionAt: schedule.nextRevisionAt,
    createdAt: now,
    updatedAt: now,
  };
}

/** Inserts a version inside an existing transaction (keeps "one preferred" invariant). */
export async function insertSolutionInTx(doc: SolutionVersionDoc, session: ClientSession) {
  if (doc.isPreferred) await clearPreferred(doc.userId, doc.problemId, session);
  await insertSolution(doc, session);
  await recomputeProblemSummary(doc.userId, doc.problemId, session);
  return doc;
}

export async function createSolution(user: AuthUser, problemIdRaw: string, input: CreateSolutionInput, now = new Date()) {
  const problemId = toObjectId(problemIdRaw);
  if (!problemId) throw notFound("Problem");
  return withTransaction(async (session) => {
    const problem = await findProblem(user.id, problemId, session);
    if (!problem) throw notFound("Problem");
    return insertSolutionInTx(buildSolutionDoc(user, problemId, input, now), session);
  });
}

export async function listSolutions(user: AuthUser, problemIdRaw: string) {
  const problemId = toObjectId(problemIdRaw);
  if (!problemId) throw notFound("Problem");
  const problem = await findProblem(user.id, problemId);
  if (!problem) throw notFound("Problem");
  return listSolutionsForProblem(user.id, problemId);
}

export async function getSolution(user: AuthUser, idRaw: string) {
  const id = toObjectId(idRaw);
  const solution = id ? await findSolution(user.id, id) : null;
  if (!solution) throw notFound("Solution");
  return solution;
}

export async function updateSolution(user: AuthUser, idRaw: string, input: UpdateSolutionInput, now = new Date()) {
  const id = toObjectId(idRaw);
  if (!id) throw notFound("Solution");
  return withTransaction(async (session) => {
    const existing = await findSolution(user.id, id, session);
    if (!existing) throw notFound("Solution");
    const set: Partial<SolutionVersionDoc> = { ...input, updatedAt: now };
    if (input.label !== undefined && !input.label) {
      set.label = defaultLabel({
        label: "",
        programmingLanguage: input.programmingLanguage ?? existing.programmingLanguage,
        approach: input.approach ?? existing.approach,
      });
    }
    const updated = await updateSolutionFields(user.id, id, set, session);
    if (!updated) throw notFound("Solution");
    if (input.programmingLanguage && input.programmingLanguage !== existing.programmingLanguage) {
      await recomputeProblemSummary(user.id, existing.problemId, session);
    }
    return updated;
  });
}

export async function deleteSolution(user: AuthUser, idRaw: string) {
  const id = toObjectId(idRaw);
  if (!id) throw notFound("Solution");
  await withTransaction(async (session) => {
    const existing = await findSolution(user.id, id, session);
    if (!existing) throw notFound("Solution");
    await deleteRevisionsForVersion(user.id, id, session);
    await deleteSolutionDoc(user.id, id, session);
    await recomputeProblemSummary(user.id, existing.problemId, session);
  });
}

/** Marks (or unmarks) the preferred version; at most one per problem. */
export async function setPreferred(user: AuthUser, idRaw: string, preferred: boolean, now = new Date()) {
  const id = toObjectId(idRaw);
  if (!id) throw notFound("Solution");
  return withTransaction(async (session) => {
    const existing = await findSolution(user.id, id, session);
    if (!existing) throw notFound("Solution");
    if (preferred) await clearPreferred(user.id, existing.problemId, session, id);
    const updated = await updateSolutionFields(user.id, id, { isPreferred: preferred, updatedAt: now }, session);
    await recomputeProblemSummary(user.id, existing.problemId, session);
    return updated!;
  });
}

/** Loads two versions of the same problem owned by the user. */
export async function compareSolutions(user: AuthUser, aRaw: string, bRaw: string) {
  const [a, b] = await Promise.all([getSolution(user, aRaw), getSolution(user, bRaw)]);
  if (!a.problemId.equals(b.problemId)) {
    throw new ApiError("BAD_REQUEST", "Both versions must belong to the same problem");
  }
  return { a, b };
}
