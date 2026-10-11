import "server-only";
import type { ClientSession, ObjectId } from "mongodb";
import { collections } from "@/lib/mongodb/collections";
import type { UserDoc } from "@/types/domain";

export async function findUserByEmail(email: string) {
  const { users } = await collections();
  return users.findOne({ email });
}

export async function findUserById(id: ObjectId) {
  const { users } = await collections();
  return users.findOne({ _id: id });
}

export async function insertUser(doc: UserDoc) {
  const { users } = await collections();
  await users.insertOne(doc);
  return doc;
}

export async function updateUser(
  id: ObjectId,
  set: Partial<Pick<UserDoc, "name" | "timezone" | "passwordHash">>,
  options: { bumpTokenVersion?: boolean } = {},
) {
  const { users } = await collections();
  return users.findOneAndUpdate(
    { _id: id },
    {
      $set: { ...set, updatedAt: new Date() },
      ...(options.bumpTokenVersion ? { $inc: { tokenVersion: 1 } } : {}),
    },
    { returnDocument: "after" },
  );
}

/** Deletes the user and everything they own. Call inside a transaction. */
export async function deleteUserCascade(id: ObjectId, session: ClientSession) {
  const c = await collections();
  await c.revisionSessions.deleteMany({ userId: id }, { session });
  await c.solutionVersions.deleteMany({ userId: id }, { session });
  await c.problems.deleteMany({ userId: id }, { session });
  const res = await c.users.deleteOne({ _id: id }, { session });
  return res.deletedCount === 1;
}
