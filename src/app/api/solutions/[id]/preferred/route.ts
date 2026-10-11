import { z } from "zod";
import { authedRoute, json, readJson } from "@/lib/http/handler";
import { toSolutionDTO } from "@/lib/mappers";
import { setPreferred } from "@/services/solutions/solution.service";

const schema = z.object({ preferred: z.boolean().default(true) });

export const POST = authedRoute<{ id: string }>(async (req, user, { id }) => {
  const { preferred } = await readJson(req, schema);
  return json({ solution: toSolutionDTO(await setPreferred(user, id, preferred)) });
});
