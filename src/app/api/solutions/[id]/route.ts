import { authedRoute, json, readJson } from "@/lib/http/handler";
import { updateSolutionSchema } from "@/lib/validations/solution";
import { toSolutionDTO } from "@/lib/mappers";
import { deleteSolution, getSolution, updateSolution } from "@/services/solutions/solution.service";

type P = { id: string };

export const GET = authedRoute<P>(async (_req, user, { id }) => json({ solution: toSolutionDTO(await getSolution(user, id)) }));

export const PATCH = authedRoute<P>(async (req, user, { id }) => {
  const input = await readJson(req, updateSolutionSchema);
  return json({ solution: toSolutionDTO(await updateSolution(user, id, input)) });
});

export const DELETE = authedRoute<P>(async (_req, user, { id }) => {
  await deleteSolution(user, id);
  return json({ ok: true });
});
