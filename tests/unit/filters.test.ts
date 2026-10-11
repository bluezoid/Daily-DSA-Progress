import { describe, expect, it } from "vitest";
import { ObjectId } from "mongodb";
import { filtersToSearchParams, parseProblemFilters } from "@/lib/validations/filters";
import { buildProblemMatch, buildProblemListPipeline, buildSort } from "@/services/problems/query-builder";

const userId = new ObjectId();
const ctx = { now: new Date("2026-05-10T12:00:00Z"), timezone: "UTC" };

describe("parseProblemFilters", () => {
  it("parses comma-separated multi values and drops unknown ones", () => {
    const f = parseProblemFilters(new URLSearchParams("difficulty=easy,medium,bogus&status=solved&sort=nope&page=0"));
    expect(f.difficulty).toEqual(["easy", "medium"]);
    expect(f.status).toEqual(["solved"]);
    expect(f.sort).toBe("created_desc");
    expect(f.page).toBe(1);
  });

  it("never lets operator objects through", () => {
    const f = parseProblemFilters({ q: { $gt: "" } as unknown as string, sort: { $where: "1" } as unknown as string });
    expect(f.q).toBeUndefined();
    expect(f.sort).toBe("created_desc");
    const params = new URLSearchParams();
    params.set("difficulty[$ne]", "easy");
    params.set("priorityMin", "{\"$gt\":0}");
    const g = parseProblemFilters(params);
    expect(g.difficulty).toEqual([]);
    expect(g.priorityMin).toBeUndefined();
  });

  it("caps page size and validates priority bounds", () => {
    const f = parseProblemFilters(new URLSearchParams("pageSize=5000&priorityMin=0&priorityMax=11"));
    expect(f.pageSize).toBe(20);
    expect(f.priorityMin).toBeUndefined();
    expect(f.priorityMax).toBeUndefined();
  });

  it("round-trips through URL params", () => {
    const f = parseProblemFilters(new URLSearchParams("q=two&difficulty=hard&topics=DP,Graphs&topicMode=all&page=3"));
    const again = parseProblemFilters(filtersToSearchParams(f));
    expect(again).toEqual(f);
  });
});

describe("buildProblemMatch", () => {
  it("always scopes to the user first", () => {
    const m = buildProblemMatch(userId, parseProblemFilters({}), ctx);
    expect(Object.keys(m)[0]).toBe("userId");
    expect(m.userId).toBe(userId);
  });

  it("escapes regex metacharacters in search", () => {
    const m = buildProblemMatch(userId, parseProblemFilters({ q: "a.*(b" }), ctx) as { $and: { $or: { title?: RegExp }[] }[] };
    const rx = m.$and[0].$or[0].title as RegExp;
    expect(rx.test("xa.*(by")).toBe(true);
    expect(rx.test("aXXb")).toBe(false);
  });

  it("combines priority bands with OR and range with AND", () => {
    const m = buildProblemMatch(
      userId,
      parseProblemFilters({ priorityBand: "high,unranked", priorityMin: "7" }),
      ctx,
    );
    expect(m.$and).toEqual([
      { priorityScore: { $gte: 7, $lte: 10 } },
      { $or: [{ priorityScore: { $gte: 8, $lte: 10 } }, { priorityScore: null }] },
    ]);
  });

  it("uses user-local day boundaries for revision status", () => {
    const m = buildProblemMatch(userId, parseProblemFilters({ revision: "overdue" }), {
      ...ctx,
      timezone: "Asia/Kolkata",
    });
    expect(m.$and).toEqual([{ nextRevisionAt: { $lt: new Date("2026-05-09T18:30:00Z") } }]);
  });

  it("treats date ranges as inclusive local days", () => {
    const m = buildProblemMatch(userId, parseProblemFilters({ createdFrom: "2026-01-01", createdTo: "2026-01-31" }), ctx);
    expect(m.$and).toEqual([
      { createdAt: { $gte: new Date("2026-01-01T00:00:00Z"), $lt: new Date("2026-02-01T00:00:00Z") } },
    ]);
  });
});

describe("buildSort", () => {
  it("ranks unranked problems last for both priority directions, with tie-breakers", () => {
    expect(buildSort("priority_desc").sort).toEqual({ _ranked: -1, priorityScore: -1, createdAt: -1, _id: -1 });
    expect(buildSort("priority_asc").sort).toEqual({ _ranked: -1, priorityScore: 1, createdAt: -1, _id: -1 });
  });

  it("produces a facet with skip/limit from the page", () => {
    const p = buildProblemListPipeline(userId, parseProblemFilters({ page: "3", pageSize: "10" }), ctx);
    const facet = p.at(-1)!.$facet;
    expect(facet.items[0]).toEqual({ $skip: 20 });
    expect(facet.items[1]).toEqual({ $limit: 10 });
  });
});
