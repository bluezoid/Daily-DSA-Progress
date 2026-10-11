import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { call, createUser, disconnect, resetDb } from "../helpers";
import * as problems from "@/app/api/problems/route";
import * as problem from "@/app/api/problems/[id]/route";
import * as solutions from "@/app/api/problems/[id]/solutions/route";
import * as solution from "@/app/api/solutions/[id]/route";
import * as preferred from "@/app/api/solutions/[id]/preferred/route";
import * as compare from "@/app/api/solutions/compare/route";
import * as revisions from "@/app/api/revisions/route";
import * as queue from "@/app/api/revisions/queue/route";
import * as dashboard from "@/app/api/dashboard/route";
import * as facets from "@/app/api/problems/facets/route";

let a: Awaited<ReturnType<typeof createUser>>;
let b: Awaited<ReturnType<typeof createUser>>;
let aProblem: string;
let aSolution: string;
let aSolution2: string;

beforeAll(async () => {
  await resetDb();
  a = await createUser("Alice");
  b = await createUser("Bob");
  const p = await call(problems.POST, {
    method: "POST",
    token: a.token,
    body: { title: "Alice secret", topics: ["SecretTopic"], priorityScore: 9, initialSolution: { programmingLanguage: "python", code: "secret()" } },
  });
  aProblem = p.body.problem.id;
  aSolution = p.body.solution.id;
  aSolution2 = (
    await call(solutions.POST, { method: "POST", token: a.token, params: { id: aProblem }, body: { programmingLanguage: "go", code: "x" } })
  ).body.solution.id;
});
afterAll(disconnect);

describe("cross-user isolation (B attacking A)", () => {
  it("cannot read, update or delete A's problem", async () => {
    expect((await call(problem.GET, { token: b.token, params: { id: aProblem } })).status).toBe(404);
    expect((await call(problem.PATCH, { method: "PATCH", token: b.token, params: { id: aProblem }, body: { title: "pwned" } })).status).toBe(404);
    expect((await call(problem.DELETE, { method: "DELETE", token: b.token, params: { id: aProblem } })).status).toBe(404);
    expect((await call(problem.GET, { token: a.token, params: { id: aProblem } })).body.problem.title).toBe("Alice secret");
  });

  it("cannot list, read, edit, delete, prefer or compare A's solutions", async () => {
    expect((await call(solutions.GET, { token: b.token, params: { id: aProblem } })).status).toBe(404);
    expect(
      (await call(solutions.POST, { method: "POST", token: b.token, params: { id: aProblem }, body: { programmingLanguage: "c", code: "x" } })).status,
    ).toBe(404);
    expect((await call(solution.GET, { token: b.token, params: { id: aSolution } })).status).toBe(404);
    expect((await call(solution.PATCH, { method: "PATCH", token: b.token, params: { id: aSolution }, body: { code: "pwned" } })).status).toBe(404);
    expect((await call(solution.DELETE, { method: "DELETE", token: b.token, params: { id: aSolution } })).status).toBe(404);
    expect((await call(preferred.POST, { method: "POST", token: b.token, params: { id: aSolution }, body: {} })).status).toBe(404);
    expect((await call(compare.GET, { token: b.token, url: `/api/solutions/compare?a=${aSolution}&b=${aSolution2}` })).status).toBe(404);
  });

  it("cannot create revisions against A's solution or read A's history", async () => {
    const res = await call(revisions.POST, {
      method: "POST",
      token: b.token,
      body: { solutionVersionId: aSolution, outcome: "solved_independently", confidence: 5 },
    });
    expect(res.status).toBe(404);
    const hist = await call(revisions.GET, { token: b.token, url: `/api/revisions?solutionVersionId=${aSolution}` });
    expect(hist.body.items).toEqual([]);
  });

  it("never sees A's data in lists, filters, queue, facets or dashboard", async () => {
    const list = await call(problems.GET, { token: b.token, url: "/api/problems?q=secret&priorityBand=high&topics=SecretTopic" });
    expect(list.body.total).toBe(0);
    const all = await call(problems.GET, { token: b.token, url: "/api/problems" });
    expect(all.body.total).toBe(0);
    const q = await call(queue.GET, { token: b.token, url: "/api/revisions/queue?upcomingDays=60" });
    expect([...q.body.overdue, ...q.body.today, ...q.body.upcoming]).toEqual([]);
    const f = await call(facets.GET, { token: b.token });
    expect(f.body.topics).toEqual([]);
    const d = await call(dashboard.GET, { token: b.token });
    expect(d.body.metrics).toMatchObject({ totalProblems: 0, totalSolutions: 0, highPriority: 0 });
    expect(d.body.recentProblems).toEqual([]);
  });

  it("A still sees everything", async () => {
    const d = await call(dashboard.GET, { token: a.token });
    expect(d.body.metrics).toMatchObject({ totalProblems: 1, totalSolutions: 2, highPriority: 1 });
  });
});
