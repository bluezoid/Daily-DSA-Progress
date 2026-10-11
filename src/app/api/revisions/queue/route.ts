import { authedRoute, json } from "@/lib/http/handler";
import { queueQuerySchema } from "@/lib/validations/revision";
import { getRevisionQueue } from "@/services/revisions/revision.service";

export const GET = authedRoute(async (req, user) => {
  const sp = req.nextUrl.searchParams;
  const q = queueQuerySchema.parse({ sort: sp.get("sort") ?? undefined, upcomingDays: sp.get("upcomingDays") ?? undefined });
  return json(await getRevisionQueue(user, q));
});
