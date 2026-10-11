import "server-only";
import type { ClientSession, Filter, ObjectId } from "mongodb";
import { collections } from "@/lib/mongodb/collections";
import type { RevisionSessionDoc } from "@/types/domain";

export async function insertRevision(doc: RevisionSessionDoc, session: ClientSession) {
  const { revisionSessions } = await collections();
  await revisionSessions.insertOne(doc, { session });
  return doc;
}

export async function listRevisions(
  userId: ObjectId,
  scope: { problemId?: ObjectId; solutionVersionId?: ObjectId },
  limit: number,
) {
  const { revisionSessions } = await collections();
  const filter: Filter<RevisionSessionDoc> = { userId };
  if (scope.problemId) filter.problemId = scope.problemId;
  if (scope.solutionVersionId) filter.solutionVersionId = scope.solutionVersionId;
  return revisionSessions.find(filter).sort({ revisedAt: -1, _id: -1 }).limit(limit).toArray();
}

export async function deleteRevisionsForVersion(userId: ObjectId, solutionVersionId: ObjectId, session: ClientSession) {
  const { revisionSessions } = await collections();
  await revisionSessions.deleteMany({ userId, solutionVersionId }, { session });
}

export async function deleteRevisionsForProblem(userId: ObjectId, problemId: ObjectId, session: ClientSession) {
  const { revisionSessions } = await collections();
  await revisionSessions.deleteMany({ userId, problemId }, { session });
}
