import { authedRoute, json } from "@/lib/http/handler";
import { getDashboard } from "@/services/dashboard/dashboard.service";

export const GET = authedRoute(async (_req, user) => json(await getDashboard(user)));
