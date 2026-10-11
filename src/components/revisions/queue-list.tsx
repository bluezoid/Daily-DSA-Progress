import Link from "next/link";
import { Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DifficultyBadge, DueBadge, LanguageBadge, PriorityBadge } from "@/components/common/badges";
import type { QueueItem } from "@/services/revisions/revision.service";

function dueText(i: QueueItem) {
  if (i.daysUntilDue < 0) return `${-i.daysUntilDue} day${i.daysUntilDue === -1 ? "" : "s"} overdue`;
  if (i.daysUntilDue === 0) return "Due today";
  return i.daysUntilDue === 1 ? "Due tomorrow" : `Due in ${i.daysUntilDue} days`;
}

export function QueueList({ items, emptyText }: { items: QueueItem[]; emptyText: string }) {
  if (items.length === 0) return <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">{emptyText}</p>;
  return (
    <ul className="grid gap-2">
      {items.map((i) => (
        <li key={i.solutionVersionId} className="flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <Link href={`/problems/${i.problemId}`} className="font-medium hover:text-primary hover:underline underline-offset-4">
              {i.problemTitle}
            </Link>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="text-sm text-muted-foreground">{i.label}</span>
              <LanguageBadge language={i.programmingLanguage} />
              <DifficultyBadge difficulty={i.difficulty} />
              <PriorityBadge score={i.priorityScore} compact />
              <span className="text-xs text-muted-foreground">· revised {i.revisionCount}×</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DueBadge tone={i.bucket} label={dueText(i)} />
            <Button asChild size="sm" variant={i.bucket === "upcoming" ? "outline" : "default"}>
              <Link href={`/revise/${i.solutionVersionId}?mode=${i.bucket === "upcoming" ? "manual" : "scheduled"}`}>
                <Brain aria-hidden /> {i.bucket === "upcoming" ? "Revise early" : "Start"}
              </Link>
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
