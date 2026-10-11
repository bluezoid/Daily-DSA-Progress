import "server-only";
import { ObjectId } from "mongodb";
import type { Difficulty, QueueSort, RevisionOutcome } from "@/lib/constants";
import { ApiError, notFound } from "@/lib/http/errors";
import { collections, withTransaction } from "@/lib/mongodb/collections";
import { calendarDaysUntil, dayBoundaries, startOfDayPlus } from "@/lib/utils/dates";
import { toObjectId } from "@/lib/utils/objectid";
import type { AuthUser } from "@/lib/auth/session";
import type { CreateRevisionInput } from "@/lib/validations/revision";
import type { Language } from "@/lib/constants";
import type { RevisionSessionDoc } from "@/types/domain";
import { findProblem } from "@/repositories/problems.repository";
import { findSolution, recomputeProblemSummary, updateSolutionFields } from "@/repositories/solutions.repository";
import { insertRevision, listRevisions } from "@/repositories/revisions.repository";
import { computeNextSchedule } from "./schedule";

/**
 * Records a revision attempt and reschedules the version. Revision count, stage and
 * dates are computed here; nothing schedule-related is taken from the client.
 */
export async function submitRevision(user: AuthUser, input: CreateRevisionInput, now = new Date()) {
  const versionId = toObjectId(input.solutionVersionId);
  if (!versionId) throw notFound("Solution");
  const { startOfTomorrow } = dayBoundaries(now, user.timezone);

  return withTransaction(async (session) => {
    const version = await findSolution(user.id, versionId, session);
    if (!version) throw notFound("Solution");
    const problem = await findProblem(user.id, version.problemId, session);
    if (!problem) throw notFound("Problem");

    const schedule = computeNextSchedule({
      stage: version.stage,
      outcome: input.outcome,
      confidence: input.confidence,
      restartSchedule: input.restartSchedule,
      now,
      timezone: user.timezone,
    });

    const revision: RevisionSessionDoc = {
      _id: new ObjectId(),
      userId: user.id,
      problemId: problem._id,
      solutionVersionId: version._id,
      revisedAt: now,
      outcome: input.outcome,
      confidence: input.confidence,
      usedHints: input.usedHints || input.outcome === "solved_with_hints",
      viewedSolution: input.viewedSolution || input.outcome === "viewed_solution",
      restartedSchedule: schedule.restarted,
      notes: input.notes,
      mode: input.mode,
      wasDue: version.nextRevisionAt !== null && version.nextRevisionAt < startOfTomorrow,
      stageBefore: version.stage,
      stageAfter: schedule.stageAfter,
      previousNextRevisionAt: version.nextRevisionAt,
      nextRevisionAt: schedule.nextRevisionAt,
    };
    await insertRevision(revision, session);

    // Guard on revisionCount so a concurrent submission cannot double-apply.
    const updated = await updateSolutionFields(
      user.id,
      version._id,
      {
        revisionCount: version.revisionCount + 1,
        stage: schedule.stageAfter,
        lastRevisedAt: now,
        nextRevisionAt: schedule.nextRevisionAt,
        updatedAt: now,
      },
      session,
      { revisionCount: version.revisionCount },
    );
    if (!updated) throw new ApiError("CONFLICT", "This solution was revised concurrently. Reload and try again.");
    await recomputeProblemSummary(user.id, problem._id, session);
    return { revision, version: updated, intervalDays: schedule.intervalDays };
  });
}

export interface QueueItem {
  solutionVersionId: string;
  problemId: string;
  problemTitle: string;
  difficulty: Difficulty;
  priorityScore: number | null;
  label: string;
  programmingLanguage: Language;
  revisionCount: number;
  nextRevisionAt: string;
  daysUntilDue: number; // negative = overdue by that many days
  bucket: "overdue" | "today" | "upcoming";
  problemCreatedAt: string;
}

interface QueueRow {
  _id: ObjectId;
  problemId: ObjectId;
  label: string;
  programmingLanguage: Language;
  revisionCount: number;
  nextRevisionAt: Date;
  problem: { title: string; difficulty: Difficulty; difficultyRank: number; priorityScore: number | null; createdAt: Date };
}

/** Due, overdue and upcoming revision tasks (one task per solution version). */
export async function getRevisionQueue(
  user: AuthUser,
  opts: { sort: QueueSort; upcomingDays: number },
  now = new Date(),
) {
  const { startOfToday, startOfTomorrow } = dayBoundaries(now, user.timezone);
  const horizon = startOfDayPlus(now, user.timezone, opts.upcomingDays + 1);
  const { solutionVersions } = await collections();
  const rows = await solutionVersions
    .aggregate<QueueRow>([
      { $match: { userId: user.id, nextRevisionAt: { $lt: horizon } } },
      { $sort: { nextRevisionAt: 1, _id: 1 } },
      { $limit: 500 },
      {
        $lookup: {
          from: "problems",
          let: { pid: "$problemId", uid: "$userId" },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ["$_id", "$$pid"] }, { $eq: ["$userId", "$$uid"] }] } } },
            { $project: { title: 1, difficulty: 1, difficultyRank: 1, priorityScore: 1, createdAt: 1 } },
          ],
          as: "problem",
        },
      },
      { $unwind: "$problem" },
      { $project: { code: 0, approach: 0, personalNotes: 0 } },
    ])
    .toArray();

  const keyed = rows.map((r) => ({
    rank: r.problem.difficultyRank,
    created: r.problem.createdAt.getTime(),
    item: {
    solutionVersionId: r._id.toHexString(),
    problemId: r.problemId.toHexString(),
    problemTitle: r.problem.title,
    difficulty: r.problem.difficulty,
    priorityScore: r.problem.priorityScore ?? null,
    label: r.label,
    programmingLanguage: r.programmingLanguage,
    revisionCount: r.revisionCount,
    nextRevisionAt: r.nextRevisionAt.toISOString(),
    daysUntilDue: calendarDaysUntil(r.nextRevisionAt, now, user.timezone),
    bucket: r.nextRevisionAt < startOfToday ? "overdue" : r.nextRevisionAt < startOfTomorrow ? "today" : "upcoming",
    problemCreatedAt: r.problem.createdAt.toISOString(),
    } satisfies QueueItem,
  }));

  type K = (typeof keyed)[number];
  const byDate = (a: K, b: K) => a.item.nextRevisionAt.localeCompare(b.item.nextRevisionAt);
  const sorters: Record<QueueSort, (a: K, b: K) => number> = {
    most_overdue: byDate,
    next_date: byDate,
    priority: (a, b) => (b.item.priorityScore ?? 0) - (a.item.priorityScore ?? 0) || byDate(a, b),
    difficulty: (a, b) => b.rank - a.rank || byDate(a, b),
    recent: (a, b) => b.created - a.created || byDate(a, b),
  };
  keyed.sort(sorters[opts.sort]);
  const clean: QueueItem[] = keyed.map((k) => k.item);
  return {
    overdue: clean.filter((i) => i.bucket === "overdue"),
    today: clean.filter((i) => i.bucket === "today"),
    upcoming: clean.filter((i) => i.bucket === "upcoming"),
  };
}

export async function getRevisionHistory(
  user: AuthUser,
  scope: { problemId?: string; solutionVersionId?: string },
  limit: number,
) {
  const problemId = scope.problemId ? toObjectId(scope.problemId) : undefined;
  const solutionVersionId = scope.solutionVersionId ? toObjectId(scope.solutionVersionId) : undefined;
  if (problemId === null || solutionVersionId === null) return [];
  return listRevisions(user.id, { problemId, solutionVersionId }, limit);
}

export async function getRevisionStats(user: AuthUser, now = new Date()) {
  const since = startOfDayPlus(now, user.timezone, -29);
  const { revisionSessions } = await collections();
  const [res] = await revisionSessions
    .aggregate<{
      totals: { total: number; avgConfidence: number }[];
      outcomes: { _id: RevisionOutcome; count: number }[];
      daily: { _id: string; count: number }[];
    }>([
      { $match: { userId: user.id } },
      {
        $facet: {
          totals: [{ $group: { _id: null, total: { $sum: 1 }, avgConfidence: { $avg: "$confidence" } } }],
          outcomes: [{ $group: { _id: "$outcome", count: { $sum: 1 } } }],
          daily: [
            { $match: { revisedAt: { $gte: since } } },
            {
              $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$revisedAt", timezone: user.timezone } },
                count: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
          ],
        },
      },
    ])
    .toArray();
  return {
    total: res?.totals[0]?.total ?? 0,
    averageConfidence: res?.totals[0]?.avgConfidence ?? null,
    outcomes: Object.fromEntries((res?.outcomes ?? []).map((o) => [o._id, o.count])) as Partial<
      Record<RevisionOutcome, number>
    >,
    daily: res?.daily.map((d) => ({ date: d._id, count: d.count })) ?? [],
  };
}
