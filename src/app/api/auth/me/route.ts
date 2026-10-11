import { authedRoute, json, readJson } from "@/lib/http/handler";
import { updateProfileSchema } from "@/lib/validations/auth";
import { toPublicUser } from "@/lib/mappers";
import { updateProfile } from "@/services/users/user.service";

export const GET = authedRoute(async (_req, user) => json({ user: toPublicUser(user) }));

export const PATCH = authedRoute(async (req, user) => {
  const input = await readJson(req, updateProfileSchema);
  const updated = await updateProfile(user, input);
  return json({ user: toPublicUser(updated) });
});
