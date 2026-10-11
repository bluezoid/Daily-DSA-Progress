import "server-only";
import { ObjectId } from "mongodb";
import { ApiError } from "@/lib/http/errors";
import { withTransaction } from "@/lib/mongodb/collections";
import { getDummyHash, hashPassword, verifyPassword } from "@/lib/auth/password";
import { isValidTimezone } from "@/lib/utils/dates";
import type { AuthUser } from "@/lib/auth/session";
import type { UserDoc } from "@/types/domain";
import {
  deleteUserCascade,
  findUserByEmail,
  findUserById,
  insertUser,
  updateUser,
} from "@/repositories/users.repository";

const GENERIC_REGISTER_ERROR =
  "Could not create the account. If you already have an account, sign in instead.";

export async function registerUser(input: { name: string; email: string; password: string; timezone?: string }) {
  const existing = await findUserByEmail(input.email);
  if (existing) {
    // Spend comparable time to a real registration so timing does not reveal the email.
    await hashPassword(input.password);
    throw new ApiError("CONFLICT", GENERIC_REGISTER_ERROR);
  }
  const now = new Date();
  const doc: UserDoc = {
    _id: new ObjectId(),
    name: input.name,
    email: input.email,
    passwordHash: await hashPassword(input.password),
    timezone: input.timezone && isValidTimezone(input.timezone) ? input.timezone : "UTC",
    tokenVersion: 0,
    createdAt: now,
    updatedAt: now,
  };
  try {
    return await insertUser(doc);
  } catch (err) {
    if ((err as { code?: number }).code === 11000) throw new ApiError("CONFLICT", GENERIC_REGISTER_ERROR);
    throw err;
  }
}

export async function authenticateUser(email: string, password: string) {
  const user = await findUserByEmail(email);
  // Always run a verification so response time does not reveal whether the email exists.
  const ok = await verifyPassword(user?.passwordHash ?? (await getDummyHash()), password);
  if (!user || !ok) throw new ApiError("UNAUTHORIZED", "Invalid email or password");
  return user;
}

export async function updateProfile(user: AuthUser, input: { name?: string; timezone?: string }) {
  const updated = await updateUser(user.id, input);
  if (!updated) throw new ApiError("UNAUTHORIZED", "Session expired");
  return updated;
}

export async function changePassword(user: AuthUser, currentPassword: string, newPassword: string) {
  const doc = await findUserById(user.id);
  if (!doc || !(await verifyPassword(doc.passwordHash, currentPassword))) {
    throw new ApiError("VALIDATION_ERROR", "Some fields are invalid", {
      fields: { currentPassword: ["Current password is incorrect"] },
    });
  }
  // Bumping the token version signs out every other session.
  const updated = await updateUser(user.id, { passwordHash: await hashPassword(newPassword) }, { bumpTokenVersion: true });
  return updated!;
}

export async function deleteAccount(user: AuthUser, password: string) {
  const doc = await findUserById(user.id);
  if (!doc || !(await verifyPassword(doc.passwordHash, password))) {
    throw new ApiError("VALIDATION_ERROR", "Some fields are invalid", {
      fields: { password: ["Password is incorrect"] },
    });
  }
  await withTransaction((session) => deleteUserCascade(user.id, session));
}
