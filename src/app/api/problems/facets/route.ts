import { authedRoute, json } from "@/lib/http/handler";
import { getFilterFacets } from "@/services/problems/problem.service";

export const GET = authedRoute(async (_req, user) => json(await getFilterFacets(user)));
