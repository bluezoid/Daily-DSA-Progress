import type { Document, Filter, ObjectId } from "mongodb";
import { PRIORITY_BAND_RANGES, type SortOption } from "@/lib/constants";
import { dayBoundaries, parseLocalDate, startOfDayPlus } from "@/lib/utils/dates";
import { escapeRegex } from "@/lib/utils/regex";
import type { ProblemFilters } from "@/lib/validations/filters";
import type { ProblemDoc } from "@/types/domain";

export interface QueryContext {
  now: Date;
  timezone: string;
}

const LIST_EXCLUDE = {
  statement: 0,
  statementText: 0,
  examples: 0,
  constraints: 0,
  followUps: 0,
  images: 0,
  similarProblems: 0,
  personalNotes: 0,
} as const;

/**
 * Builds the $match for the problem library. Only reads validated values from
 * `f`, so client input can never inject operators. userId is always the first key.
 */
export function buildProblemMatch(userId: ObjectId, f: ProblemFilters, ctx: QueryContext): Filter<ProblemDoc> {
  const and: Filter<ProblemDoc>[] = [];
  const { startOfToday, startOfTomorrow } = dayBoundaries(ctx.now, ctx.timezone);

  if (f.q) {
    const rx = new RegExp(escapeRegex(f.q), "i");
    const or: Filter<ProblemDoc>[] = [
      { title: rx },
      { sourceName: rx },
      { sourceProblemId: rx },
      { topics: rx },
      { statementText: rx },
    ];
    const num = f.q.replace(/^#/, "").trim();
    if (/^\d{1,10}$/.test(num)) or.push({ problemNumber: num });
    and.push({ $or: or });
  }

  if (f.source.length) and.push({ sourceType: { $in: f.source } });
  if (f.sourceName) and.push({ sourceName: new RegExp(escapeRegex(f.sourceName), "i") });
  if (f.difficulty.length) and.push({ difficulty: { $in: f.difficulty } });
  if (f.status.length) and.push({ status: { $in: f.status } });

  // Priority: explicit range AND (any of the selected bands).
  if (f.priorityMin !== undefined || f.priorityMax !== undefined) {
    const lo = f.priorityMin ?? 1;
    const hi = f.priorityMax ?? 10;
    and.push({ priorityScore: { $gte: Math.min(lo, hi), $lte: Math.max(lo, hi) } });
  }
  if (f.priorityBand.length) {
    const bands: Filter<ProblemDoc>[] = f.priorityBand.map((band) =>
      band === "unranked"
        ? { priorityScore: null }
        : { priorityScore: { $gte: PRIORITY_BAND_RANGES[band][0], $lte: PRIORITY_BAND_RANGES[band][1] } },
    );
    and.push(bands.length === 1 ? bands[0] : { $or: bands });
  }

  if (f.topics.length) {
    const rxs = f.topics.map((t) => new RegExp(`^${escapeRegex(t)}$`, "i"));
    if (f.topicMode === "all") rxs.forEach((rx) => and.push({ topics: rx }));
    else and.push({ topics: { $in: rxs } });
  }

  if (f.solutions === "none") and.push({ solutionCount: 0 });
  if (f.solutions === "any") and.push({ solutionCount: { $gte: 1 } });
  if (f.solutions === "multiple") and.push({ solutionCount: { $gte: 2 } });
  if (f.preferred) and.push({ hasPreferred: true });
  if (f.language.length) and.push({ languages: { $in: f.language } });

  // A problem's revision status is that of its most urgent version (earliest nextRevisionAt).
  if (f.revision.length) {
    const or: Filter<ProblemDoc>[] = f.revision.map((r) => {
      switch (r) {
        case "overdue":
          return { nextRevisionAt: { $lt: startOfToday } };
        case "due_today":
          return { nextRevisionAt: { $gte: startOfToday, $lt: startOfTomorrow } };
        case "upcoming":
          return { nextRevisionAt: { $gte: startOfTomorrow } };
        case "never_revised":
          return { neverRevisedCount: { $gt: 0 } };
        case "not_scheduled":
          return { nextRevisionAt: null };
      }
    });
    and.push(or.length === 1 ? or[0] : { $or: or });
  }

  const range = (field: keyof ProblemDoc, from?: string, to?: string) => {
    const cond: { $gte?: Date; $lt?: Date } = {};
    const start = from ? parseLocalDate(from, ctx.timezone) : null;
    const end = to ? parseLocalDate(to, ctx.timezone) : null;
    if (start) cond.$gte = start;
    if (end) cond.$lt = startOfDayPlus(end, ctx.timezone, 1);
    if (cond.$gte || cond.$lt) and.push({ [field]: cond } as Filter<ProblemDoc>);
  };
  range("createdAt", f.createdFrom, f.createdTo);
  range("updatedAt", f.updatedFrom, f.updatedTo);
  range("lastRevisedAt", f.revisedFrom, f.revisedTo);
  range("nextRevisionAt", f.nextFrom, f.nextTo);

  return and.length ? { userId, $and: and } : { userId };
}

const TIE = { createdAt: -1, _id: -1 } as const;

/** Sort helpers: `_ranked`/`_hasNext`/`_known` push nulls/unknowns last in both directions. */
export function buildSort(sort: SortOption): { addFields?: Document; sort: Record<string, 1 | -1> } {
  const isSet = (field: string) => ({ $cond: [{ $eq: [{ $ifNull: [`$${field}`, null] }, null] }, 0, 1] });
  switch (sort) {
    case "created_asc":
      return { sort: { createdAt: 1, _id: 1 } };
    case "updated_desc":
      return { sort: { updatedAt: -1, ...TIE } };
    case "priority_desc":
      return { addFields: { _ranked: isSet("priorityScore") }, sort: { _ranked: -1, priorityScore: -1, ...TIE } };
    case "priority_asc":
      return { addFields: { _ranked: isSet("priorityScore") }, sort: { _ranked: -1, priorityScore: 1, ...TIE } };
    case "difficulty_asc":
    case "difficulty_desc":
      return {
        addFields: { _known: { $cond: [{ $gt: ["$difficultyRank", 0] }, 1, 0] } },
        sort: { _known: -1, difficultyRank: sort === "difficulty_asc" ? 1 : -1, ...TIE },
      };
    case "title_asc":
      return { sort: { titleLower: 1, ...TIE } };
    case "title_desc":
      return { sort: { titleLower: -1, ...TIE } };
    case "revised_desc":
      return { addFields: { _rev: isSet("lastRevisedAt") }, sort: { _rev: -1, lastRevisedAt: -1, ...TIE } };
    case "next_revision_asc":
      return { addFields: { _hasNext: isSet("nextRevisionAt") }, sort: { _hasNext: -1, nextRevisionAt: 1, ...TIE } };
    case "solutions_desc":
      return { sort: { solutionCount: -1, ...TIE } };
    case "status_asc":
      return { sort: { statusRank: 1, ...TIE } };
    case "created_desc":
    default:
      return { sort: { ...TIE } };
  }
}

export function buildProblemListPipeline(userId: ObjectId, f: ProblemFilters, ctx: QueryContext): Document[] {
  const { addFields, sort } = buildSort(f.sort);
  const pipeline: Document[] = [{ $match: buildProblemMatch(userId, f, ctx) }];
  if (addFields) pipeline.push({ $addFields: addFields });
  pipeline.push({ $sort: sort });
  pipeline.push({
    $facet: {
      items: [
        { $skip: (f.page - 1) * f.pageSize },
        { $limit: f.pageSize },
        { $project: { ...LIST_EXCLUDE, _ranked: 0, _known: 0, _rev: 0, _hasNext: 0 } },
      ],
      total: [{ $count: "n" }],
    },
  });
  return pipeline;
}
