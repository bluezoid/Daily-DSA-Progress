import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { call, createUser, disconnect, resetDb } from "../helpers";
import * as problems from "@/app/api/problems/route";
import * as problem from "@/app/api/problems/[id]/route";
import * as solutions from "@/app/api/problems/[id]/solutions/route";
import * as solution from "@/app/api/solutions/[id]/route";
import * as preferred from "@/app/api/solutions/[id]/preferred/route";
import * as compare from "@/app/api/solutions/compare/route";
import * as revisions from "@/app/api/revisions/route";
import { getDb } from "@/lib/mongodb/client";
import { getRevisionQueue, submitRevision } from "@/services/revisions/revision.service";
import { createSolution } from "@/services/solutions/solution.service";
import { createProblem } from "@/services/problems/problem.service";
import { createProblemSchema } from "@/lib/validations/problem";
import { createSolutionSchema } from "@/lib/validations/solution";
import { createRevisionSchema } from "@/lib/validations/revision";

beforeEach(resetDb);
afterAll(disconnect);

async function setup() {
  const u = await createUser();
  const p = await call(problems.POST, { method: "POST", token: u.token, body: { title: "Two Sum" } });
  const problemId = p.body.problem.id as string;
  const add = async (programmingLanguage: string, approach: string) =>
    (
      await call(solutions.POST, {
        method: "POST",
        token: u.token,
        params: { id: problemId },
        body: { programmingLanguage, approach, code: `// ${approach}` },
      })
    ).body.solution;
  return { u, problemId, add };
}

describe("solution versions", () => {
  it("stores multiple languages and approaches with independent schedules", async () => {
    const { u, problemId, add } = await setup();
    const a = await add("python", "Hash Map");
    const b = await add("python", "Brute Force");
    const c = await add("javascript", "Hash Map");
    expect(a.label).toBe("Python — Hash Map");
    const list = await call(solutions.GET, { token: u.token, params: { id: problemId } });
    expect(list.body.solutions).toHaveLength(3);
    const p = await call(problem.GET, { token: u.token, params: { id: problemId } });
    expect(p.body.problem).toMatchObject({ solutionCount: 3, languages: ["javascript", "python"], hasPreferred: false });

    await call(revisions.POST, {
      method: "POST",
      token: u.token,
      body: { solutionVersionId: a.id, outcome: "solved_independently", confidence: 5 },
    });
    const [sa, sb] = await Promise.all(
      [a.id, b.id].map(async (id) => (await call(solution.GET, { token: u.token, params: { id } })).body.solution),
    );
    expect(sa.revisionCount).toBe(1);
    expect(sb.revisionCount).toBe(0);
    expect(sa.nextRevisionAt).not.toBe(sb.nextRevisionAt);
    expect(c.id).toBeTruthy();
  });

  it("keeps exactly one preferred version", async () => {
    const { u, problemId, add } = await setup();
    const a = await add("python", "A");
    const b = await add("cpp", "B");
    await call(preferred.POST, { method: "POST", token: u.token, params: { id: a.id }, body: { preferred: true } });
    await call(preferred.POST, { method: "POST", token: u.token, params: { id: b.id }, body: { preferred: true } });
    const list = (await call(solutions.GET, { token: u.token, params: { id: problemId } })).body.solutions;
    expect(list.filter((s: { isPreferred: boolean }) => s.isPreferred).map((s: { id: string }) => s.id)).toEqual([b.id]);
    expect((await call(problem.GET, { token: u.token, params: { id: problemId } })).body.problem.hasPreferred).toBe(true);

    await call(preferred.POST, { method: "POST", token: u.token, params: { id: b.id }, body: { preferred: false } });
    expect((await call(problem.GET, { token: u.token, params: { id: problemId } })).body.problem.hasPreferred).toBe(false);
  });

  it("stays consistent under concurrent preferred changes", async () => {
    const { u, problemId, add } = await setup();
    const versions = await Promise.all(["A", "B", "C", "D"].map((x) => add("go", x)));
    await Promise.all(
      versions.map((v) => call(preferred.POST, { method: "POST", token: u.token, params: { id: v.id }, body: { preferred: true } })),
    );
    const list = (await call(solutions.GET, { token: u.token, params: { id: problemId } })).body.solutions;
    expect(list.filter((s: { isPreferred: boolean }) => s.isPreferred)).toHaveLength(1);
  });

  it("compares two versions of the same problem only", async () => {
    const { u, add } = await setup();
    const a = await add("python", "A");
    const b = await add("rust", "B");
    const res = await call(compare.GET, { token: u.token, url: `/api/solutions/compare?a=${a.id}&b=${b.id}` });
    expect(res.body.a.id).toBe(a.id);
    expect(res.body.b.programmingLanguage).toBe("rust");

    const other = await call(problems.POST, {
      method: "POST",
      token: u.token,
      body: { title: "Other", initialSolution: { programmingLanguage: "c", code: "int main(){}" } },
    });
    const bad = await call(compare.GET, { token: u.token, url: `/api/solutions/compare?a=${a.id}&b=${other.body.solution.id}` });
    expect(bad.status).toBe(400);
  });

  it("deleting a version removes its revision history and updates the summary", async () => {
    const { u, problemId, add } = await setup();
    const a = await add("python", "A");
    await add("java", "B");
    await call(revisions.POST, {
      method: "POST",
      token: u.token,
      body: { solutionVersionId: a.id, outcome: "unable_to_solve", confidence: 1 },
    });
    await call(solution.DELETE, { method: "DELETE", token: u.token, params: { id: a.id } });
    const db = await getDb();
    expect(await db.collection("revisionSessions").countDocuments({})).toBe(0);
    const p = (await call(problem.GET, { token: u.token, params: { id: problemId } })).body.problem;
    expect(p).toMatchObject({ solutionCount: 1, languages: ["java"] });
  });

  it("requires code", async () => {
    const { u, problemId } = await setup();
    const res = await call(solutions.POST, {
      method: "POST",
      token: u.token,
      params: { id: problemId },
      body: { programmingLanguage: "python", code: "   " },
    });
    expect(res.status).toBe(422);
  });
});

describe("revisions", () => {
  it("schedules 1 day after creation, then 3, 7, 14, 30 days after successful revisions", async () => {
    const u = await createUser("Rev", "UTC");
    const day0 = new Date("2026-01-01T10:00:00Z");
    const { problem: p } = await createProblem(u, createProblemSchema.parse({ title: "x" }), day0);
    const s = await createSolution(u, p._id.toHexString(), createSolutionSchema.parse({ programmingLanguage: "python", code: "x" }), day0);
    expect(s.nextRevisionAt!.toISOString()).toBe("2026-01-02T00:00:00.000Z");

    const expected = ["2026-01-05", "2026-01-12", "2026-01-26", "2026-02-25", "2026-03-27"];
    let now = new Date("2026-01-02T09:00:00Z");
    for (const day of expected) {
      const r = await submitRevision(
        u,
        createRevisionSchema.parse({ solutionVersionId: s._id.toHexString(), outcome: "solved_independently", confidence: 4, mode: "scheduled" }),
        now,
      );
      expect(r.version.nextRevisionAt!.toISOString().slice(0, 10)).toBe(day);
      expect(r.revision.wasDue).toBe(true);
      now = new Date(r.version.nextRevisionAt!.getTime() + 8 * 3600_000);
    }
  });

  it("restarts after a failed revision and preserves full history", async () => {
    const { u, add } = await setup();
    const a = await add("python", "A");
    await call(revisions.POST, { method: "POST", token: u.token, body: { solutionVersionId: a.id, outcome: "solved_independently", confidence: 5 } });
    const fail = await call(revisions.POST, {
      method: "POST",
      token: u.token,
      body: { solutionVersionId: a.id, outcome: "viewed_solution", confidence: 1, notes: "forgot the trick" },
    });
    expect(fail.status).toBe(201);
    expect(fail.body).toMatchObject({ intervalDays: 1, revision: { stageBefore: 1, stageAfter: 0, restartedSchedule: true, viewedSolution: true } });

    const hist = await call(revisions.GET, { token: u.token, url: `/api/revisions?solutionVersionId=${a.id}` });
    expect(hist.body.items.map((r: { outcome: string }) => r.outcome)).toEqual(["viewed_solution", "solved_independently"]);
    expect(hist.body.items[0].notes).toBe("forgot the trick");
  });

  it.each([0, 6, 2.5])("rejects confidence %s", async (confidence) => {
    const { u, add } = await setup();
    const a = await add("python", "A");
    const res = await call(revisions.POST, { method: "POST", token: u.token, body: { solutionVersionId: a.id, outcome: "solved_with_hints", confidence } });
    expect(res.status).toBe(422);
  });

  it("ignores client-supplied scheduling fields", async () => {
    const { u, add } = await setup();
    const a = await add("python", "A");
    const res = await call(revisions.POST, {
      method: "POST",
      token: u.token,
      body: { solutionVersionId: a.id, outcome: "solved_with_hints", confidence: 3, nextRevisionAt: "2099-01-01", revisionCount: 50 },
    });
    expect(res.body.solution.revisionCount).toBe(1);
    expect(res.body.solution.nextRevisionAt.startsWith("2099")).toBe(false);
  });

  it("builds overdue / today / upcoming queues from real timestamps", async () => {
    const u = await createUser("Q", "UTC");
    const created = new Date("2026-04-01T12:00:00Z");
    const mk = async (title: string, at: Date) => {
      const { problem: p } = await createProblem(u, createProblemSchema.parse({ title, priorityScore: 5 }), at);
      return createSolution(u, p._id.toHexString(), createSolutionSchema.parse({ programmingLanguage: "python", code: "x" }), at);
    };
    await mk("old", created); // due 04-02
    await mk("today", new Date("2026-04-09T08:00:00Z")); // due 04-10
    await mk("future", new Date("2026-04-12T08:00:00Z")); // due 04-13
    const q = await getRevisionQueue(u, { sort: "most_overdue", upcomingDays: 14 }, new Date("2026-04-10T12:00:00Z"));
    expect(q.overdue.map((i) => i.problemTitle)).toEqual(["old"]);
    expect(q.overdue[0].daysUntilDue).toBe(-8);
    expect(q.today.map((i) => i.problemTitle)).toEqual(["today"]);
    expect(q.upcoming.map((i) => i.problemTitle)).toEqual(["future"]);
    expect(q.upcoming[0].daysUntilDue).toBe(3);
  });

  it("records manual revisions of versions that are not yet due", async () => {
    const { u, add } = await setup();
    const a = await add("python", "A");
    const res = await call(revisions.POST, {
      method: "POST",
      token: u.token,
      body: { solutionVersionId: a.id, outcome: "solved_independently", confidence: 4, mode: "manual" },
    });
    expect(res.body.revision).toMatchObject({ mode: "manual", wasDue: false });
    expect(res.body.solution.revisionCount).toBe(1);
  });
});
