import { authedRoute, json, readJson } from "@/lib/http/handler";
import { updateProblemSchema } from "@/lib/validations/problem";
import { toProblemDTO } from "@/lib/mappers";
import { deleteProblem, getProblem, updateProblem } from "@/services/problems/problem.service";

type P = { id: string };

export const GET = authedRoute<P>(async (_req, user, { id }) => json({ problem: toProblemDTO(await getProblem(user, id)) }));

export const PATCH = authedRoute<P>(async (req, user, { id }) => {
  const input = await readJson(req, updateProblemSchema);
  return json({ problem: toProblemDTO(await updateProblem(user, id, input)) });
});

export const DELETE = authedRoute<P>(async (_req, user, { id }) => {
  await deleteProblem(user, id);
  return json({ ok: true });
});
