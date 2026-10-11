import { authedRoute, json, readJson } from "@/lib/http/handler";
import { createSolutionSchema } from "@/lib/validations/solution";
import { toSolutionDTO } from "@/lib/mappers";
import { createSolution, listSolutions } from "@/services/solutions/solution.service";

type P = { id: string };

export const GET = authedRoute<P>(async (_req, user, { id }) =>
  json({ solutions: (await listSolutions(user, id)).map(toSolutionDTO) }),
);

export const POST = authedRoute<P>(async (req, user, { id }) => {
  const input = await readJson(req, createSolutionSchema);
  return json({ solution: toSolutionDTO(await createSolution(user, id, input)) }, 201);
});
