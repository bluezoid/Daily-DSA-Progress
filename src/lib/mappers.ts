import type {
  ProblemDoc,
  ProblemDTO,
  ProblemListItemDTO,
  PublicUser,
  RevisionSessionDoc,
  RevisionSessionDTO,
  SolutionVersionDoc,
  SolutionVersionDTO,
  UserDoc,
} from "@/types/domain";
import type { AuthUser } from "@/lib/auth/session";

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

export function toPublicUser(u: UserDoc | AuthUser): PublicUser {
  const id = "_id" in u ? u._id : u.id;
  return {
    id: id.toHexString(),
    name: u.name,
    email: u.email,
    timezone: u.timezone,
    createdAt: u.createdAt.toISOString(),
  };
}

export function toProblemListItem(p: ProblemDoc): ProblemListItemDTO {
  return {
    id: p._id.toHexString(),
    title: p.title,
    slug: p.slug,
    problemNumber: p.problemNumber,
    sourceType: p.sourceType,
    sourceName: p.sourceName,
    sourceUrl: p.sourceUrl,
    sourceProblemId: p.sourceProblemId,
    difficulty: p.difficulty,
    statementFormat: p.statementFormat,
    topics: p.topics,
    status: p.status,
    priorityScore: p.priorityScore,
    importedAt: iso(p.importedAt),
    solutionCount: p.solutionCount,
    languages: p.languages,
    hasPreferred: p.hasPreferred,
    nextRevisionAt: iso(p.nextRevisionAt),
    lastRevisedAt: iso(p.lastRevisedAt),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export function toProblemDTO(p: ProblemDoc): ProblemDTO {
  return {
    ...toProblemListItem(p),
    statement: p.statement,
    examples: p.examples,
    constraints: p.constraints,
    followUps: p.followUps,
    images: p.images,
    similarProblems: p.similarProblems,
    personalNotes: p.personalNotes,
  };
}

export function toSolutionDTO(s: SolutionVersionDoc): SolutionVersionDTO {
  return {
    id: s._id.toHexString(),
    problemId: s.problemId.toHexString(),
    label: s.label,
    code: s.code,
    programmingLanguage: s.programmingLanguage,
    approach: s.approach,
    timeComplexity: s.timeComplexity,
    spaceComplexity: s.spaceComplexity,
    personalNotes: s.personalNotes,
    isPreferred: s.isPreferred,
    stage: s.stage,
    revisionCount: s.revisionCount,
    lastRevisedAt: iso(s.lastRevisedAt),
    nextRevisionAt: iso(s.nextRevisionAt),
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

export function toRevisionDTO(r: RevisionSessionDoc): RevisionSessionDTO {
  return {
    id: r._id.toHexString(),
    problemId: r.problemId.toHexString(),
    solutionVersionId: r.solutionVersionId.toHexString(),
    revisedAt: r.revisedAt.toISOString(),
    outcome: r.outcome,
    confidence: r.confidence,
    usedHints: r.usedHints,
    viewedSolution: r.viewedSolution,
    restartedSchedule: r.restartedSchedule,
    notes: r.notes,
    mode: r.mode,
    wasDue: r.wasDue,
    stageBefore: r.stageBefore,
    stageAfter: r.stageAfter,
    previousNextRevisionAt: iso(r.previousNextRevisionAt),
    nextRevisionAt: r.nextRevisionAt.toISOString(),
  };
}
