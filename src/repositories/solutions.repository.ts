import "server-only";
import type { ClientSession, ObjectId } from "mongodb";
import { collections } from "@/lib/mongodb/collections";
import type { Language } from "@/lib/constants";
import type { SolutionVersionDoc } from "@/types/domain";

export async function insertSolution(doc: SolutionVersionDoc, session?: ClientSession) {
  const { solutionVersions } = await collections();
  await solutionVersions.insertOne(doc, { session });
  return doc;
}

export async function findSolution(userId: ObjectId, id: ObjectId, session?: ClientSession) {
  const { solutionVersions } = await collections();
  return solutionVersions.findOne({ _id: id, userId }, { session });
}

export async function listSolutionsForProblem(userId: ObjectId, problemId: ObjectId) {
  const { solutionVersions } = await collections();
  return solutionVersions
    .find({ userId, problemId })
    .sort({ isPreferred: -1, createdAt: 1, _id: 1 })
    .toArray();
}

export async function updateSolutionFields(
  userId: ObjectId,
  id: ObjectId,
  set: Partial<SolutionVersionDoc>,
  session?: ClientSession,
  extraFilter: Partial<Pick<SolutionVersionDoc, "revisionCount">> = {},
) {
  const { solutionVersions } = await collections();
  return solutionVersions.findOneAndUpdate(
    { _id: id, userId, ...extraFilter },
    { $set: set },
    { returnDocument: "after", session },
  );
}

export async function clearPreferred(
  userId: ObjectId,
  problemId: ObjectId,
  session: ClientSession,
  exceptId?: ObjectId,
) {
  const { solutionVersions } = await collections();
  await solutionVersions.updateMany(
    { userId, problemId, isPreferred: true, ...(exceptId ? { _id: { $ne: exceptId } } : {}) },
    { $set: { isPreferred: false, updatedAt: new Date() } },
    { session },
  );
}

export async function deleteSolutionDoc(userId: ObjectId, id: ObjectId, session: ClientSession) {
  const { solutionVersions } = await collections();
  const res = await solutionVersions.deleteOne({ _id: id, userId }, { session });
  return res.deletedCount === 1;
}

export async function deleteSolutionsForProblem(userId: ObjectId, problemId: ObjectId, session: ClientSession) {
  const { solutionVersions } = await collections();
  await solutionVersions.deleteMany({ userId, problemId }, { session });
}

interface Summary {
  solutionCount: number;
  languages: Language[];
  hasPreferred: boolean;
  nextRevisionAt: Date | null;
  lastRevisedAt: Date | null;
  neverRevisedCount: number;
}

/**
 * Recomputes the denormalized solution summary stored on the problem.
 * Must run in the same transaction as any change to that problem's versions.
 */
export async function recomputeProblemSummary(userId: ObjectId, problemId: ObjectId, session?: ClientSession) {
  const { solutionVersions, problems } = await collections();
  const [agg] = await solutionVersions
    .aggregate<Summary>(
      [
        { $match: { userId, problemId } },
        {
          $group: {
            _id: null,
            solutionCount: { $sum: 1 },
            languages: { $addToSet: "$programmingLanguage" },
            hasPreferred: { $max: "$isPreferred" },
            nextRevisionAt: { $min: "$nextRevisionAt" },
            lastRevisedAt: { $max: "$lastRevisedAt" },
            neverRevisedCount: { $sum: { $cond: [{ $eq: ["$revisionCount", 0] }, 1, 0] } },
          },
        },
        { $project: { _id: 0 } },
      ],
      { session },
    )
    .toArray();
  const summary: Summary = {
    solutionCount: agg?.solutionCount ?? 0,
    languages: (agg?.languages ?? []).sort(),
    hasPreferred: Boolean(agg?.hasPreferred),
    nextRevisionAt: agg?.nextRevisionAt ?? null,
    lastRevisedAt: agg?.lastRevisedAt ?? null,
    neverRevisedCount: agg?.neverRevisedCount ?? 0,
  };
  await problems.updateOne({ _id: problemId, userId }, { $set: summary }, { session });
  return summary;
}
