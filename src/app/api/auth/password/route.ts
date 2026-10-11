import { authedRoute, json, readJson } from "@/lib/http/handler";
import { changePasswordSchema } from "@/lib/validations/auth";
import { rateLimit } from "@/lib/auth/rate-limit";
import { setSessionCookie } from "@/lib/auth/session";
import { changePassword } from "@/services/users/user.service";

export const POST = authedRoute(async (req, user) => {
  await rateLimit(`password:${user.id.toHexString()}`, 10, 15 * 60);
  const input = await readJson(req, changePasswordSchema);
  const updated = await changePassword(user, input.currentPassword, input.newPassword);
  // Other sessions are invalidated by the token version bump; re-issue this one.
  const res = json({ ok: true });
  await setSessionCookie(res, updated);
  return res;
});
