import { OUTCOME_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import type { RevisionSessionDTO } from "@/types/domain";
import { cn } from "@/lib/utils";

const OUTCOME_TONE = {
  solved_independently: "text-emerald-700 dark:text-emerald-400",
  solved_with_hints: "text-sky-700 dark:text-sky-400",
  viewed_solution: "text-amber-700 dark:text-amber-400",
  unable_to_solve: "text-rose-700 dark:text-rose-400",
} as const;

export function RevisionHistory({
  items,
  timezone,
  versionLabels,
}: {
  items: RevisionSessionDTO[];
  timezone: string;
  versionLabels?: Record<string, string>;
}) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">No revisions recorded yet.</p>;
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">Date</th>
            {versionLabels && <th scope="col" className="px-3 py-2 font-medium">Version</th>}
            <th scope="col" className="px-3 py-2 font-medium">Outcome</th>
            <th scope="col" className="px-3 py-2 font-medium">Confidence</th>
            <th scope="col" className="px-3 py-2 font-medium">Next due</th>
            <th scope="col" className="px-3 py-2 font-medium">Notes</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((r) => (
            <tr key={r.id} className="align-top">
              <td className="px-3 py-2 whitespace-nowrap">
                {formatDate(r.revisedAt, timezone, true)}
                <div className="text-[11px] text-muted-foreground">{r.mode === "manual" ? (r.wasDue ? "Manual · was due" : "Manual · early") : "From queue"}</div>
              </td>
              {versionLabels && <td className="px-3 py-2">{versionLabels[r.solutionVersionId] ?? "—"}</td>}
              <td className={cn("px-3 py-2 font-medium", OUTCOME_TONE[r.outcome])}>
                {OUTCOME_LABELS[r.outcome]}
                <div className="text-[11px] font-normal text-muted-foreground">
                  {[r.usedHints && "hints", r.viewedSolution && "viewed solution", r.restartedSchedule && "schedule restarted"].filter(Boolean).join(" · ")}
                </div>
              </td>
              <td className="px-3 py-2 tabular-nums" aria-label={`Confidence ${r.confidence} of 5`}>{r.confidence}/5</td>
              <td className="px-3 py-2 whitespace-nowrap">{formatDate(r.nextRevisionAt, timezone)}</td>
              <td className="max-w-xs px-3 py-2 text-muted-foreground">{r.notes || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
