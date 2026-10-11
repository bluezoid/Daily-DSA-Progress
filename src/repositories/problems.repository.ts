import "server-only";
import { ObjectId, type ClientSession, type Document } from "mongodb";
import { collections } from "@/lib/mongodb/collections";
import type { ProblemDoc } from "@/types/domain";

// Every query below is scoped by userId. Never look a problem up by _id alone.

export async function insertProblem(doc: ProblemDoc, session?: ClientSession) {
  const { problems } = await collections();
  await problems.insertOne(doc, { session });
  return doc;
}

export async function findProblem(userId: ObjectId, id: ObjectId, session?: ClientSession) {
  const { problems } = await collections();
  return problems.findOne({ _id: id, userId }, { session });
}

export async function findProblemByCanonicalUrl(userId: ObjectId, canonicalUrl: string) {
  const { problems } = await collections();
  return problems.findOne(
    { userId, canonicalUrl },
    { projection: { _id: 1, title: 1 }, sort: { createdAt: 1 } },
  );
}

export async function updateProblemFields(
  userId: ObjectId,
  id: ObjectId,
  set: Partial<ProblemDoc>,
  session?: ClientSession,
) {
  const { problems } = await collections();
  return problems.findOneAndUpdate(
    { _id: id, userId },
    { $set: set },
    { returnDocument: "after", session },
  );
}

export async function deleteProblemDoc(userId: ObjectId, id: ObjectId, session: ClientSession) {
  const { problems } = await collections();
  const res = await problems.deleteOne({ _id: id, userId }, { session });
  return res.deletedCount === 1;
}

/** Runs a pipeline whose first stage MUST be a $match containing { userId }. */
export async function aggregateProblems<T extends Document>(userId: ObjectId, pipeline: Document[]) {
  const first = pipeline[0] as { $match?: { userId?: unknown } } | undefined;
  const scopedTo = first?.$match?.userId;
  if (!(scopedTo instanceof ObjectId) || !scopedTo.equals(userId)) throw new Error("aggregateProblems: pipeline must start with a userId-scoped $match");
  const { problems } = await collections();
  return problems.aggregate<T>(pipeline).toArray();
}
