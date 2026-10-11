import { publicRoute, json, readJson } from "@/lib/http/handler";
import { loginSchema } from "@/lib/validations/auth";
import { clientIp, rateLimit } from "@/lib/auth/rate-limit";
import { setSessionCookie } from "@/lib/auth/session";
import { authenticateUser } from "@/services/users/user.service";
import { toPublicUser } from "@/lib/mappers";

export const POST = publicRoute(async (req) => {
  const input = await readJson(req, loginSchema);
  await rateLimit(`login:ip:${clientIp(req)}`, 20, 15 * 60);
  await rateLimit(`login:email:${input.email}`, 10, 15 * 60);
  const user = await authenticateUser(input.email, input.password);
  const res = json({ user: toPublicUser(user) });
  await setSessionCookie(res, user);
  return res;
});
