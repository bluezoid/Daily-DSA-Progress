import { publicRoute, json, readJson } from "@/lib/http/handler";
import { registerSchema } from "@/lib/validations/auth";
import { clientIp, rateLimit } from "@/lib/auth/rate-limit";
import { setSessionCookie } from "@/lib/auth/session";
import { registerUser } from "@/services/users/user.service";
import { toPublicUser } from "@/lib/mappers";

export const POST = publicRoute(async (req) => {
  await rateLimit(`register:ip:${clientIp(req)}`, 5, 60 * 60);
  const input = await readJson(req, registerSchema);
  const user = await registerUser(input);
  const res = json({ user: toPublicUser(user) }, 201);
  await setSessionCookie(res, user);
  return res;
});
