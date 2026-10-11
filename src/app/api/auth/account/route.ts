import { authedRoute, json, readJson } from "@/lib/http/handler";
import { deleteAccountSchema } from "@/lib/validations/auth";
import { rateLimit } from "@/lib/auth/rate-limit";
import { clearSessionCookie } from "@/lib/auth/session";
import { deleteAccount } from "@/services/users/user.service";

export const DELETE = authedRoute(async (req, user) => {
  await rateLimit(`delete-account:${user.id.toHexString()}`, 5, 15 * 60);
  const input = await readJson(req, deleteAccountSchema);
  await deleteAccount(user, input.password);
  const res = json({ ok: true });
  clearSessionCookie(res);
  return res;
});
