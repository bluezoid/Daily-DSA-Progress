import { authedRoute, json, readJson } from "@/lib/http/handler";
import { createRevisionSchema, historyQuerySchema } from "@/lib/validations/revision";
import { toRevisionDTO, toSolutionDTO } from "@/lib/mappers";
import { getRevisionHistory, submitRevision } from "@/services/revisions/revision.service";

export const GET = authedRoute(async (req, user) => {
  const sp = req.nextUrl.searchParams;
  const q = historyQuerySchema.parse({
    solutionVersionId: sp.get("solutionVersionId") ?? undefined,
    problemId: sp.get("problemId") ?? undefined,
    limit: sp.get("limit") ?? undefined,
  });
  const items = await getRevisionHistory(user, q, q.limit);
  return json({ items: items.map(toRevisionDTO) });
});

export const POST = authedRoute(async (req, user) => {
  const input = await readJson(req, createRevisionSchema);
  const { revision, version, intervalDays } = await submitRevision(user, input);
  return json({ revision: toRevisionDTO(revision), solution: toSolutionDTO(version), intervalDays }, 201);
});
