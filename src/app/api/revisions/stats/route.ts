import { authedRoute, json } from "@/lib/http/handler";
import { getRevisionStats } from "@/services/revisions/revision.service";

export const GET = authedRoute(async (_req, user) => json(await getRevisionStats(user)));
