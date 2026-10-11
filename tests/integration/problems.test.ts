import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { call, createUser, disconnect, resetDb } from "../helpers";
import * as problems from "@/app/api/problems/route";
import * as problem from "@/app/api/problems/[id]/route";
import * as solutions from "@/app/api/problems/[id]/solutions/route";
import * as preview from "@/app/api/imports/leetcode/preview/route";
import { getDb } from "@/lib/mongodb/client";

beforeEach(resetDb);
afterAll(disconnect);

describe("manual problem creation", () => {
  it("works with only a title (no URL, statement or solution)", async () => {
    const u = await createUser();
    const res = await call(problems.POST, { method: "POST", token: u.token, body: { title: "Reverse a linked list" } });
    expect(res.status).toBe(201);
    expect(res.body.problem).toMatchObject({
      title: "Reverse a linked list",
      sourceType: "personal",
      sourceName: "Personal",
      sourceUrl: null,
      difficulty: "unknown",
      status: "todo",
      priorityScore: null,
      solutionCount: 0,
      nextRevisionAt: null,
    });
    expect(res.body.solution).toBeNull();
  });

  it("requires a custom name for the Other source", async () => {
    const u = await createUser();
    const bad = await call(problems.POST, { method: "POST", token: u.token, body: { title: "x", sourceType: "other" } });
    expect(bad.status).toBe(422);
    expect(bad.body.error.fields.sourceName).toBeDefined();
    const ok = await call(problems.POST, {
      method: "POST",
      token: u.token,
      body: { title: "x", sourceType: "other", sourceName: "CSES" },
    });
    expect(ok.body.problem.sourceName).toBe("CSES");
  });

  it("creates the initial solution and schedules it", async () => {
    const u = await createUser();
    const res = await call(problems.POST, {
      method: "POST",
      token: u.token,
      body: { title: "Two Sum", initialSolution: { programmingLanguage: "python", code: "def f(): pass" } },
    });
    expect(res.body.solution).toMatchObject({ programmingLanguage: "python", label: "Python", revisionCount: 0, stage: 0 });
    expect(res.body.problem).toMatchObject({ solutionCount: 1, languages: ["python"] });
    expect(res.body.problem.nextRevisionAt).toBe(res.body.solution.nextRevisionAt);
  });

  it("sanitizes HTML statements on write", async () => {
    const u = await createUser();
    const res = await call(problems.POST, {
      method: "POST",
      token: u.token,
      body: { title: "x", statementFormat: "html", statement: '<p>ok</p><script>alert(1)</script><img src=x onerror="y">' },
    });
    expect(res.body.problem.statement).toBe("<p>ok</p>");
  });
});

describe("priority score", () => {
  it.each([0, 11, 5.5, "7"])("rejects %s", async (priorityScore) => {
    const u = await createUser();
    const res = await call(problems.POST, { method: "POST", token: u.token, body: { title: "x", priorityScore } });
    expect(res.status).toBe(422);
  });

  it("can be set, changed and cleared", async () => {
    const u = await createUser();
    const created = await call(problems.POST, { method: "POST", token: u.token, body: { title: "x", priorityScore: 3 } });
    const id = created.body.problem.id;
    const upd = await call(problem.PATCH, { method: "PATCH", token: u.token, params: { id }, body: { priorityScore: 9 } });
    expect(upd.body.problem.priorityScore).toBe(9);
    const cleared = await call(problem.PATCH, { method: "PATCH", token: u.token, params: { id }, body: { priorityScore: null } });
    expect(cleared.body.problem.priorityScore).toBeNull();
  });
});

describe("CRUD", () => {
  it("updates and deletes with cascading cleanup", async () => {
    const u = await createUser();
    const created = await call(problems.POST, {
      method: "POST",
      token: u.token,
      body: { title: "x", initialSolution: { programmingLanguage: "go", code: "package main" } },
    });
    const id = created.body.problem.id;
    const upd = await call(problem.PATCH, {
      method: "PATCH",
      token: u.token,
      params: { id },
      body: { title: "Renamed", status: "solved", difficulty: "hard", topics: ["DP", "dp", "Graphs"] },
    });
    expect(upd.body.problem).toMatchObject({ title: "Renamed", status: "solved", difficulty: "hard", topics: ["DP", "Graphs"] });

    const del = await call(problem.DELETE, { method: "DELETE", token: u.token, params: { id } });
    expect(del.status).toBe(200);
    expect((await call(problem.GET, { token: u.token, params: { id } })).status).toBe(404);
    const db = await getDb();
    expect(await db.collection("solutionVersions").countDocuments({})).toBe(0);
  });

  it("returns 404 for malformed ids", async () => {
    const u = await createUser();
    expect((await call(problem.GET, { token: u.token, params: { id: "not-an-id" } })).status).toBe(404);
    expect((await call(problem.GET, { token: u.token, params: { id: "{\"$ne\":null}" } })).status).toBe(404);
  });

  it("rejects unknown fields such as userId on update", async () => {
    const u = await createUser();
    const other = await createUser("Other");
    const created = await call(problems.POST, { method: "POST", token: u.token, body: { title: "x" } });
    const res = await call(problem.PATCH, {
      method: "PATCH",
      token: u.token,
      params: { id: created.body.problem.id },
      body: { userId: other.id.toHexString(), solutionCount: 99 },
    });
    expect(res.status).toBe(422);
  });
});

describe("duplicates and imports", () => {
  it("detects a duplicate URL, but allows an intentional separate record", async () => {
    const u = await createUser();
    const body = { title: "Two Sum", sourceType: "leetcode", sourceUrl: "https://leetcode.com/problems/two-sum/" };
    const first = await call(problems.POST, { method: "POST", token: u.token, body });
    const dup = await call(problems.POST, {
      method: "POST",
      token: u.token,
      body: { ...body, sourceUrl: "https://www.leetcode.com/problems/two-sum/description/" },
    });
    expect(dup.status).toBe(409);
    expect(dup.body.error).toMatchObject({ code: "DUPLICATE", existingId: first.body.problem.id });

    const forced = await call(problems.POST, { method: "POST", token: u.token, body: { ...body, allowDuplicate: true } });
    expect(forced.status).toBe(201);

    // Another user can save the same problem.
    const v = await createUser("V");
    expect((await call(problems.POST, { method: "POST", token: v.token, body })).status).toBe(201);
  });

  it("imported and manual problems share one model", async () => {
    process.env.IMPORT_MOCK = "1";
    try {
      const u = await createUser();
      const p = await call(preview.POST, {
        method: "POST",
        token: u.token,
        body: { url: "https://leetcode.com/problems/pair-target-indices/" },
      });
      expect(p.status).toBe(200);
      expect(p.body).toMatchObject({ ok: true, duplicate: null, missingFields: [] });

      const d = p.body.data;
      const saved = await call(problems.POST, {
        method: "POST",
        token: u.token,
        body: {
          ...d,
          sourceType: "leetcode",
          sourceUrl: p.body.canonicalUrl,
          statementFormat: "html",
          priorityScore: 8,
          importMeta: { missingFields: p.body.missingFields },
        },
      });
      expect(saved.status).toBe(201);
      await call(problems.POST, { method: "POST", token: u.token, body: { title: "Manual one" } });

      const list = await call(problems.GET, { token: u.token, url: "/api/problems" });
      expect(list.body.total).toBe(2);
      const keys = list.body.items.map((i: Record<string, unknown>) => Object.keys(i).sort().join());
      expect(keys[0]).toBe(keys[1]);

      const again = await call(preview.POST, {
        method: "POST",
        token: u.token,
        body: { url: "https://leetcode.com/problems/pair-target-indices/" },
      });
      expect(again.body.duplicate).toMatchObject({ id: saved.body.problem.id });
    } finally {
      delete process.env.IMPORT_MOCK;
    }
  });

  it("returns an honest failure for unsupported URLs", async () => {
    const u = await createUser();
    const res = await call(preview.POST, { method: "POST", token: u.token, body: { url: "http://169.254.169.254/latest" } });
    expect(res.body).toMatchObject({ ok: false, reason: "invalid_url" });
  });
});

describe("problems without solutions", () => {
  it("lists an empty solution set", async () => {
    const u = await createUser();
    const created = await call(problems.POST, { method: "POST", token: u.token, body: { title: "x" } });
    const res = await call(solutions.GET, { token: u.token, params: { id: created.body.problem.id } });
    expect(res.body.solutions).toEqual([]);
  });
});
