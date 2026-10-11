import { z } from "zod";
import { authedRoute, json } from "@/lib/http/handler";
import { objectIdString } from "@/lib/utils/objectid";
import { toSolutionDTO } from "@/lib/mappers";
import { compareSolutions } from "@/services/solutions/solution.service";

const schema = z.object({ a: objectIdString, b: objectIdString });

export const GET = authedRoute(async (req, user) => {
  const { a, b } = schema.parse({ a: req.nextUrl.searchParams.get("a"), b: req.nextUrl.searchParams.get("b") });
  const res = await compareSolutions(user, a, b);
  return json({ a: toSolutionDTO(res.a), b: toSolutionDTO(res.b) });
});
