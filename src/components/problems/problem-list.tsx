import Link from "next/link";
import { Star } from "lucide-react";
import { DifficultyBadge, DueBadge, SourceBadge, StatusBadge, TopicChip } from "@/components/common/badges";
import { PriorityEditor } from "./priority-editor";
import { ProblemRowActions } from "./problem-row-actions";
import { LANGUAGE_LABELS } from "@/lib/constants";
import { dueLabel, dueTone, formatDate } from "@/lib/format";
import type { ProblemListItemDTO } from "@/types/domain";

function Solutions({ p }: { p: ProblemListItemDTO }) {
  if (p.solutionCount === 0) return <span className="text-xs text-muted-foreground">None yet</span>;
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <span className="tabular-nums">{p.solutionCount}</span>
      {p.hasPreferred && <Star className="size-3 fill-amber-500 text-amber-500" aria-label="Has preferred solution" />}
      <span className="truncate text-muted-foreground">· {p.languages.map((l) => LANGUAGE_LABELS[l]).join(", ")}</span>
    </span>
  );
}

function TitleCell({ p }: { p: ProblemListItemDTO }) {
  return (
    <div className="min-w-0">
      <Link href={`/problems/${p.id}`} className="font-medium hover:text-primary hover:underline underline-offset-4">
        {p.problemNumber && <span className="mr-1 text-muted-foreground tabular-nums">{p.problemNumber}.</span>}
        {p.title}
      </Link>
      {p.topics.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {p.topics.slice(0, 4).map((t) => (
            <TopicChip key={t} topic={t} />
          ))}
          {p.topics.length > 4 && <span className="text-[11px] text-muted-foreground">+{p.topics.length - 4}</span>}
        </div>
      )}
    </div>
  );
}

export function ProblemList({ items, timezone }: { items: ProblemListItemDTO[]; timezone: string }) {
  const now = new Date();
  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-xl border md:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-2.5 font-medium">Problem</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Difficulty</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Priority</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Solutions</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Revision</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Added</th>
              <th scope="col" className="w-10 px-2 py-2.5"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((p) => (
              <tr key={p.id} className="align-top hover:bg-muted/20">
                <td className="max-w-sm px-3 py-3">
                  <TitleCell p={p} />
                  <div className="mt-1">
                    <SourceBadge sourceType={p.sourceType} sourceName={p.sourceName} className="h-5 text-[11px]" />
                  </div>
                </td>
                <td className="px-3 py-3"><DifficultyBadge difficulty={p.difficulty} /></td>
                <td className="px-3 py-3"><StatusBadge status={p.status} /></td>
                <td className="px-3 py-3"><PriorityEditor problemId={p.id} score={p.priorityScore} compact /></td>
                <td className="max-w-40 px-3 py-3"><Solutions p={p} /></td>
                <td className="px-3 py-3"><DueBadge tone={dueTone(p.nextRevisionAt, timezone, now)} label={dueLabel(p.nextRevisionAt, timezone, now)} /></td>
                <td className="px-3 py-3 text-xs whitespace-nowrap text-muted-foreground">{formatDate(p.createdAt, timezone)}</td>
                <td className="px-2 py-2"><ProblemRowActions id={p.id} title={p.title} sourceUrl={p.sourceUrl} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="grid gap-2 md:hidden">
        {items.map((p) => (
          <li key={p.id} className="rounded-xl border bg-card p-3">
            <div className="flex items-start justify-between gap-2">
              <TitleCell p={p} />
              <ProblemRowActions id={p.id} title={p.title} sourceUrl={p.sourceUrl} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <DifficultyBadge difficulty={p.difficulty} />
              <StatusBadge status={p.status} />
              <PriorityEditor problemId={p.id} score={p.priorityScore} compact />
              <SourceBadge sourceType={p.sourceType} sourceName={p.sourceName} />
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <Solutions p={p} />
              <DueBadge tone={dueTone(p.nextRevisionAt, timezone, now)} label={dueLabel(p.nextRevisionAt, timezone, now)} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
