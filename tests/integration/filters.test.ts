import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createUser, disconnect, resetDb } from "../helpers";
import { createProblem, listProblems } from "@/services/problems/problem.service";
import { createSolution } from "@/services/solutions/solution.service";
import { submitRevision } from "@/services/revisions/revision.service";
import { createProblemSchema } from "@/lib/validations/problem";
import { createSolutionSchema } from "@/lib/validations/solution";
import { createRevisionSchema } from "@/lib/validations/revision";
import { parseProblemFilters } from "@/lib/validations/filters";

type U = Awaited<ReturnType<typeof createUser>>;
let u: U;
let other: U;
const NOW = new Date("2026-06-15T12:00:00Z");

async function add(
  user: U,
  data: Record<string, unknown>,
  opts: { createdAt: string; langs?: string[]; reviseAt?: string; preferred?: boolean } ,
) {
  const created = new Date(opts.createdAt);
  const { problem } = await createProblem(user, createProblemSchema.parse(data), created);
  const ids: string[] = [];
  for (const [i, lang] of (opts.langs ?? []).entries()) {
    const s = await createSolution(
      user,
      problem._id.toHexString(),
      createSolutionSchema.parse({ programmingLanguage: lang, code: "x", isPreferred: opts.preferred && i === 0 }),
      created,
    );
    ids.push(s._id.toHexString());
  }
  if (opts.reviseAt && ids[0]) {
    await submitRevision(
      user,
      createRevisionSchema.parse({ solutionVersionId: ids[0], outcome: "solved_independently", confidence: 5 }),
      new Date(opts.reviseAt),
    );
  }
  return problem;
}

const titles = async (query: string, user: U = u) =>
  (await listProblems(user, parseProblemFilters(new URLSearchParams(query)), NOW)).items.map((p) => p.title);

beforeAll(async () => {
  await resetDb();
  u = await createUser("Filter", "UTC");
  other = await createUser("Other", "UTC");

  // Due dates: created at T => first revision due T+1 day (local midnight).
  await add(u, { title: "LC DP Medium", sourceType: "leetcode", difficulty: "medium", status: "attempted", priorityScore: 9, topics: ["Dynamic Programming", "Arrays"] },
    { createdAt: "2026-06-01T10:00:00Z", langs: ["python", "java"] }); // overdue (due 06-02)
  await add(u, { title: "LC Graph Hard", sourceType: "leetcode", difficulty: "hard", status: "todo", priorityScore: 8, topics: ["Graphs"] },
    { createdAt: "2026-06-14T10:00:00Z", langs: ["cpp"], preferred: true }); // due today (06-15)
  await add(u, { title: "HR Strings Easy", sourceType: "hackerrank", difficulty: "easy", status: "solved", priorityScore: 2, topics: ["Strings"] },
    { createdAt: "2026-06-10T10:00:00Z", langs: ["python"], reviseAt: "2026-06-11T09:00:00Z" }); // revised; next 06-14 => overdue
  await add(u, { title: "Book DP Unranked", sourceType: "book", difficulty: "medium", status: "todo", topics: ["Dynamic Programming"] },
    { createdAt: "2026-05-20T10:00:00Z" }); // no solutions
  await add(u, { title: "Interview Arrays", sourceType: "interview", difficulty: "unknown", status: "needs_revision", priorityScore: 5, topics: ["Arrays", "Dynamic Programming"] },
    { createdAt: "2026-06-15T09:00:00Z", langs: ["python"] }); // upcoming (06-16)
  await add(other, { title: "Other user LC DP Medium", sourceType: "leetcode", difficulty: "medium", status: "attempted", priorityScore: 10, topics: ["Dynamic Programming"] },
    { createdAt: "2026-06-01T10:00:00Z", langs: ["python"] });
});
afterAll(disconnect);

describe("combined filters", () => {
  it("source + difficulty + status", async () => {
    expect(await titles("source=leetcode&difficulty=medium&status=attempted,todo")).toEqual(["LC DP Medium"]);
  });

  it("the spec example: unsolved LC Medium, priority >= 8, DP, Python, overdue", async () => {
    expect(await titles("status=todo,attempted,needs_revision&source=leetcode&difficulty=medium&priorityMin=8&topics=dynamic programming&language=python&revision=overdue")).toEqual([
      "LC DP Medium",
    ]);
  });

  it("priority range + topics", async () => {
    expect(await titles("priorityMin=5&priorityMax=10&topics=Arrays&sort=priority_desc")).toEqual(["LC DP Medium", "Interview Arrays"]);
  });

  it("priority bands, including unranked", async () => {
    expect(await titles("priorityBand=low,unranked&sort=title_asc")).toEqual(["Book DP Unranked", "HR Strings Easy"]);
    expect(await titles("priorityBand=high&sort=title_asc")).toEqual(["LC DP Medium", "LC Graph Hard"]);
  });

  it("topics any vs all", async () => {
    expect((await titles("topics=Arrays,Graphs")).sort()).toEqual(["Interview Arrays", "LC DP Medium", "LC Graph Hard"]);
    expect((await titles("topics=Arrays,Dynamic Programming&topicMode=all")).sort()).toEqual(["Interview Arrays", "LC DP Medium"]);
  });

  it("language + revision status", async () => {
    expect((await titles("language=python&revision=overdue")).sort()).toEqual(["HR Strings Easy", "LC DP Medium"]);
    expect(await titles("revision=due_today")).toEqual(["LC Graph Hard"]);
    expect(await titles("revision=upcoming")).toEqual(["Interview Arrays"]);
    expect(await titles("revision=not_scheduled")).toEqual(["Book DP Unranked"]);
    expect((await titles("revision=never_revised")).sort()).toEqual(["Interview Arrays", "LC DP Medium", "LC Graph Hard"]);
  });

  it("solution availability + difficulty", async () => {
    expect(await titles("solutions=none&difficulty=medium")).toEqual(["Book DP Unranked"]);
    expect(await titles("solutions=multiple")).toEqual(["LC DP Medium"]);
    expect(await titles("preferred=1")).toEqual(["LC Graph Hard"]);
  });

  it("date range + status", async () => {
    expect((await titles("createdFrom=2026-06-01&createdTo=2026-06-14&status=todo,attempted")).sort()).toEqual(["LC DP Medium", "LC Graph Hard"]);
    expect(await titles("revisedFrom=2026-06-11&revisedTo=2026-06-11")).toEqual(["HR Strings Easy"]);
  });

  it("search across title, topics and number", async () => {
    expect(await titles("q=graph")).toEqual(["LC Graph Hard"]);
    expect(await titles("q=(.*")).toEqual([]);
  });

  it("never returns another user's records", async () => {
    const all = await titles("q=DP&sort=title_asc");
    expect(all).not.toContain("Other user LC DP Medium");
    expect(await titles("", other)).toEqual(["Other user LC DP Medium"]);
  });
});

describe("sorting and pagination", () => {
  it("puts unranked problems last in both priority directions", async () => {
    expect(await titles("sort=priority_desc")).toEqual(["LC DP Medium", "LC Graph Hard", "Interview Arrays", "HR Strings Easy", "Book DP Unranked"]);
    expect(await titles("sort=priority_asc")).toEqual(["HR Strings Easy", "Interview Arrays", "LC Graph Hard", "LC DP Medium", "Book DP Unranked"]);
  });

  it("sorts difficulty with Unknown last", async () => {
    expect((await titles("sort=difficulty_desc"))[0]).toBe("LC Graph Hard");
    expect((await titles("sort=difficulty_asc")).at(-1)).toBe("Interview Arrays");
  });

  it("paginates with stable ordering and totals", async () => {
    const pages = [];
    for (let page = 1; page <= 3; page++) {
      const r = await listProblems(u, parseProblemFilters(new URLSearchParams(`pageSize=2&page=${page}&sort=status_asc`)), NOW);
      expect(r.total).toBe(5);
      expect(r.totalPages).toBe(3);
      pages.push(...r.items.map((p) => p.title));
    }
    expect(new Set(pages).size).toBe(5);
    expect(await titles("sort=status_asc")).toEqual(pages);
  });
});
