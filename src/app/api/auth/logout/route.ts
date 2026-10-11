import { publicRoute, json } from "@/lib/http/handler";
import { clearSessionCookie } from "@/lib/auth/session";

export const POST = publicRoute(async () => {
  const res = json({ ok: true });
  clearSessionCookie(res);
  return res;
});
