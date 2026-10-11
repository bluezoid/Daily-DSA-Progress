import { authedRoute, json, readJson } from "@/lib/http/handler";
import { createProblemSchema } from "@/lib/validations/problem";
import { parseProblemFilters } from "@/lib/validations/filters";
import { toProblemDTO, toProblemListItem, toSolutionDTO } from "@/lib/mappers";
import { createProblem, listProblems } from "@/services/problems/problem.service";

export const GET = authedRoute(async (req, user) => {
  const filters = parseProblemFilters(req.nextUrl.searchParams);
  const result = await listProblems(user, filters);
  return json({ ...result, items: result.items.map(toProblemListItem) });
});

export const POST = authedRoute(async (req, user) => {
  const input = await readJson(req, createProblemSchema);
  const { problem, solution } = await createProblem(user, input);
  return json({ problem: toProblemDTO(problem), solution: solution ? toSolutionDTO(solution) : null }, 201);
});
