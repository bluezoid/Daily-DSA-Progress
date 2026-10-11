import "server-only";
import {
  DIFFICULTIES,
  SOURCE_TYPES,
  STATUSES,
  type Difficulty,
  type Language,
  type ProblemStatus,
  type RevisionOutcome,
  type SourceType,
} from "@/lib/constants";
import { collections } from "@/lib/mongodb/collections";
import { dayBoundaries, localDateKey, startOfDayPlus } from "@/lib/utils/dates";
import type { AuthUser } from "@/lib/auth/session";
import { toProblemListItem } from "@/lib/mappers";
import type { ProblemDoc, ProblemListItemDTO } from "@/types/domain";
import { getRevisionQueue, getRevisionStats, type QueueItem } from "@/services/revisions/revision.service";

type CountRow<K> = { _id: K; n: number };

export interface DashboardData {
  metrics: {
    totalProblems: number;
    solved: number;
    unsolved: number; // status todo + attempted
    attempted: number;
    needsRevisionStatus: number; // status = needs_revision
    problemsWithOverdue: number; // at least one overdue version
    totalSolutions: number;
    dueToday: number; // versions
    overdue: number; // versions
    highPriority: number; // priority >= 8
    highPriorityDue: number; // priority >= 8 with a version due today or overdue
  };
  charts: {
    byDifficulty: { key: Difficulty; count: number }[];
    byStatus: { key: ProblemStatus; count: number }[];
    bySource: { key: SourceType; count: number }[];
    priority: { key: string; count: number }[]; // "1".."10", "unranked"
    activity: { date: string; count: number }[]; // last 30 days, user timezone
  };
  recentProblems: ProblemListItemDTO[];
  highPriorityProblems: ProblemListItemDTO[];
  recentRevisions: {
    id: string;
    problemId: string;
    problemTitle: string;
    versionLabel: string;
    programmingLanguage: Language;
    outcome: RevisionOutcome;
    confidence: number;
    revisedAt: string;
  }[];
  overdueRevisions: QueueItem[];
  upcomingRevisions: QueueItem[];
  revisionTotals: { total: number; averageConfidence: number | null };
}

export async function getDashboard(user: AuthUser, now = new Date()): Promise<DashboardData> {
  const { startOfToday, startOfTomorrow } = dayBoundaries(now, user.timezone);
  const c = await collections();

  const problemFacetPromise = c.problems
    .aggregate<{
      total: { n: number }[];
      byStatus: CountRow<ProblemStatus>[];
      byDifficulty: CountRow<Difficulty>[];
      bySource: CountRow<SourceType>[];
      byPriority: CountRow<number | null>[];
      highPriorityDue: { n: number }[];
      withOverdue: { n: number }[];
      recent: ProblemDoc[];
      highPriorityList: ProblemDoc[];
    }>([
      { $match: { userId: user.id } },
      {
        $facet: {
          total: [{ $count: "n" }],
          byStatus: [{ $group: { _id: "$status", n: { $sum: 1 } } }],
          byDifficulty: [{ $group: { _id: "$difficulty", n: { $sum: 1 } } }],
          bySource: [{ $group: { _id: "$sourceType", n: { $sum: 1 } } }],
          byPriority: [{ $group: { _id: "$priorityScore", n: { $sum: 1 } } }],
          highPriorityDue: [
            { $match: { priorityScore: { $gte: 8 }, nextRevisionAt: { $lt: startOfTomorrow } } },
            { $count: "n" },
          ],
          withOverdue: [{ $match: { nextRevisionAt: { $lt: startOfToday } } }, { $count: "n" }],
          recent: [{ $sort: { createdAt: -1, _id: -1 } }, { $limit: 5 }],
          highPriorityList: [
            { $match: { priorityScore: { $gte: 8 } } },
            { $sort: { priorityScore: -1, nextRevisionAt: 1, createdAt: -1 } },
            { $limit: 5 },
          ],
        },
      },
    ])
    .toArray();

  const versionCountsPromise = c.solutionVersions
    .aggregate<{ total: { n: number }[]; dueToday: { n: number }[]; overdue: { n: number }[] }>([
      { $match: { userId: user.id } },
      {
        $facet: {
          total: [{ $count: "n" }],
          dueToday: [{ $match: { nextRevisionAt: { $gte: startOfToday, $lt: startOfTomorrow } } }, { $count: "n" }],
          overdue: [{ $match: { nextRevisionAt: { $lt: startOfToday } } }, { $count: "n" }],
        },
      },
    ])
    .toArray();

  const recentRevisionsPromise = c.revisionSessions
    .aggregate<{
      _id: { toHexString(): string };
      problemId: { toHexString(): string };
      outcome: RevisionOutcome;
      confidence: number;
      revisedAt: Date;
      problem: { title: string }[];
      version: { label: string; programmingLanguage: Language }[];
    }>([
      { $match: { userId: user.id } },
      { $sort: { revisedAt: -1, _id: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "problems",
          let: { pid: "$problemId", uid: "$userId" },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ["$_id", "$$pid"] }, { $eq: ["$userId", "$$uid"] }] } } },
            { $project: { title: 1 } },
          ],
          as: "problem",
        },
      },
      {
        $lookup: {
          from: "solutionVersions",
          let: { vid: "$solutionVersionId", uid: "$userId" },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ["$_id", "$$vid"] }, { $eq: ["$userId", "$$uid"] }] } } },
            { $project: { label: 1, programmingLanguage: 1 } },
          ],
          as: "version",
        },
      },
    ])
    .toArray();

  const [[pf], [vc], recentRevisions, queue, stats] = await Promise.all([
    problemFacetPromise,
    versionCountsPromise,
    recentRevisionsPromise,
    getRevisionQueue(user, { sort: "most_overdue", upcomingDays: 7 }, now),
    getRevisionStats(user, now),
  ]);

  const count = <K extends string>(rows: CountRow<K>[] | undefined, key: K) =>
    rows?.find((r) => r._id === key)?.n ?? 0;
  const statusCount = (s: ProblemStatus) => count(pf?.byStatus, s);

  const priority = [...Array.from({ length: 10 }, (_, i) => String(i + 1)), "unranked"].map((key) => ({
    key,
    count:
      pf?.byPriority.find((r) => (key === "unranked" ? r._id == null : r._id === Number(key)))?.n ?? 0,
  }));

  // Fill all 30 days so the activity chart has a continuous axis.
  const dailyMap = new Map(stats.daily.map((d) => [d.date, d.count]));
  const activity = Array.from({ length: 30 }, (_, i) => {
    const date = localDateKey(startOfDayPlus(now, user.timezone, i - 29), user.timezone);
    return { date, count: dailyMap.get(date) ?? 0 };
  });

  const highPriority = priority.filter((p) => ["8", "9", "10"].includes(p.key)).reduce((s, p) => s + p.count, 0);

  return {
    metrics: {
      totalProblems: pf?.total[0]?.n ?? 0,
      solved: statusCount("solved"),
      unsolved: statusCount("todo") + statusCount("attempted"),
      attempted: statusCount("attempted"),
      needsRevisionStatus: statusCount("needs_revision"),
      problemsWithOverdue: pf?.withOverdue[0]?.n ?? 0,
      totalSolutions: vc?.total[0]?.n ?? 0,
      dueToday: vc?.dueToday[0]?.n ?? 0,
      overdue: vc?.overdue[0]?.n ?? 0,
      highPriority,
      highPriorityDue: pf?.highPriorityDue[0]?.n ?? 0,
    },
    charts: {
      byDifficulty: DIFFICULTIES.map((key) => ({ key, count: count(pf?.byDifficulty, key) })),
      byStatus: STATUSES.map((key) => ({ key, count: count(pf?.byStatus, key) })),
      bySource: SOURCE_TYPES.map((key) => ({ key, count: count(pf?.bySource, key) })).filter((s) => s.count > 0),
      priority,
      activity,
    },
    recentProblems: (pf?.recent ?? []).map(toProblemListItem),
    highPriorityProblems: (pf?.highPriorityList ?? []).map(toProblemListItem),
    recentRevisions: recentRevisions
      .filter((r) => r.problem[0] && r.version[0])
      .map((r) => ({
        id: r._id.toHexString(),
        problemId: r.problemId.toHexString(),
        problemTitle: r.problem[0].title,
        versionLabel: r.version[0].label,
        programmingLanguage: r.version[0].programmingLanguage,
        outcome: r.outcome,
        confidence: r.confidence,
        revisedAt: r.revisedAt.toISOString(),
      })),
    overdueRevisions: queue.overdue.slice(0, 5),
    upcomingRevisions: [...queue.today, ...queue.upcoming].slice(0, 5),
    revisionTotals: { total: stats.total, averageConfidence: stats.averageConfidence },
  };
}
