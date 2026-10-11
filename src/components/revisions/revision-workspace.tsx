"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { OUTCOMES, OUTCOME_LABELS, type RevisionOutcome } from "@/lib/constants";
import { api, ApiClientError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { RevisionSessionDTO, SolutionVersionDTO } from "@/types/domain";

const CONFIDENCE = ["Not at all", "Shaky", "Okay", "Good", "Solid"];

/** Resets on each fresh navigation (Activity would otherwise keep the revealed state). */
export function RevisionWorkspace(props: Parameters<typeof Workspace>[0]) {
  const { bfcacheId } = useRouter();
  return (
    <Fragment key={bfcacheId}>
      <Workspace {...props} />
    </Fragment>
  );
}

function Workspace({
  solutionId,
  problemId,
  mode,
  timezone,
  solutionPanel,
}: {
  solutionId: string;
  problemId: string;
  mode: "scheduled" | "manual";
  timezone: string;
  solutionPanel: React.ReactNode;
}) {
  const router = useRouter();
  const [revealed, setRevealed] = useState(false);
  const [outcome, setOutcome] = useState<RevisionOutcome | "">("");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [usedHints, setUsedHints] = useState(false);
  const [viewedSolution, setViewedSolution] = useState(false);
  const [restart, setRestart] = useState(true);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ revision: RevisionSessionDTO; solution: SolutionVersionDTO; intervalDays: number } | null>(null);

  const failed = outcome === "viewed_solution" || outcome === "unable_to_solve";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!outcome || confidence == null) {
      setError("Choose an outcome and a confidence level.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await api<{ revision: RevisionSessionDTO; solution: SolutionVersionDTO; intervalDays: number }>("/api/revisions", {
        method: "POST",
        body: {
          solutionVersionId: solutionId,
          outcome,
          confidence,
          usedHints: usedHints || outcome === "solved_with_hints",
          viewedSolution: viewedSolution || outcome === "viewed_solution",
          restartSchedule: failed ? restart : true,
          notes,
          mode,
        },
      });
      setResult(res);
      toast.success("Revision saved");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Network error. Your answers are still here. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    const next = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "long", month: "long", day: "numeric" }).format(
      new Date(result.revision.nextRevisionAt),
    );
    return (
      <div className="rounded-xl border bg-card p-6 text-center">
        <CalendarCheck className="mx-auto mb-3 size-8 text-primary" aria-hidden />
        <h2 className="text-lg font-semibold">Revision recorded</h2>
        <p className="mt-1 text-muted-foreground">
          Next revision: <strong className="text-foreground">{next}</strong> (in {result.intervalDays} day{result.intervalDays === 1 ? "" : "s"}).
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {OUTCOME_LABELS[result.revision.outcome]} · confidence {result.revision.confidence}/5 · revised {result.solution.revisionCount}×
          {result.revision.restartedSchedule && " · schedule restarted"}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link href="/revision-queue">Back to queue</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/problems/${problemId}`}>Open problem</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium">Your saved solution</h2>
          <Button
            variant={revealed ? "outline" : "secondary"}
            size="sm"
            onClick={() => {
              setRevealed((r) => !r);
              if (!revealed) setViewedSolution(true);
            }}
            aria-expanded={revealed}
            aria-controls="saved-solution"
          >
            {revealed ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
            {revealed ? "Hide solution" : "Reveal solution"}
          </Button>
        </div>
        {revealed ? (
          <div id="saved-solution" className="mt-4">
            {solutionPanel}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Hidden. Try the problem on your own first, then reveal it if you need to. Revealing it is noted on this revision.
          </p>
        )}
      </section>

      <form onSubmit={submit} className="grid gap-5 rounded-xl border bg-card p-4 sm:p-5">
        <h2 className="font-medium">How did it go?</h2>
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-medium">Outcome</legend>
          <RadioGroup value={outcome} onValueChange={(v) => setOutcome(v as RevisionOutcome)} className="grid gap-2 sm:grid-cols-2">
            {OUTCOMES.map((o) => (
              <Label
                key={o}
                htmlFor={`o-${o}`}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border p-3 font-normal",
                  outcome === o && "border-primary bg-primary/5",
                )}
              >
                <RadioGroupItem id={`o-${o}`} value={o} />
                {OUTCOME_LABELS[o]}
              </Label>
            ))}
          </RadioGroup>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-medium">Confidence</legend>
          <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Confidence from 1 to 5">
            {CONFIDENCE.map((label, i) => (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={confidence === i + 1}
                onClick={() => setConfidence(i + 1)}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-lg border px-1 py-2 text-xs focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                  confidence === i + 1 ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted",
                )}
              >
                <span className="text-base font-semibold tabular-nums">{i + 1}</span>
                <span className="text-center leading-tight">{label}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="flex items-center gap-2">
            <Checkbox id="hints" checked={usedHints || outcome === "solved_with_hints"} disabled={outcome === "solved_with_hints"} onCheckedChange={(v) => setUsedHints(v === true)} />
            <Label htmlFor="hints" className="font-normal">I used hints</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="viewed" checked={viewedSolution || outcome === "viewed_solution"} disabled={outcome === "viewed_solution"} onCheckedChange={(v) => setViewedSolution(v === true)} />
            <Label htmlFor="viewed" className="font-normal">I looked at the solution</Label>
          </div>
        </div>

        {failed && (
          <div className="flex items-start gap-2 rounded-lg border bg-muted/30 p-3">
            <Checkbox id="restart" checked={restart} onCheckedChange={(v) => setRestart(v === true)} className="mt-0.5" />
            <div>
              <Label htmlFor="restart" className="font-normal">Restart this solution&apos;s schedule (due again tomorrow)</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">Unchecked: keep the current stage and come back after half the usual interval.</p>
            </div>
          </div>
        )}

        <div className="grid gap-1.5">
          <Label htmlFor="rev-notes">Notes <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Textarea id="rev-notes" rows={3} maxLength={5000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What tripped you up? What clicked?" />
        </div>

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="animate-spin" aria-hidden />}
            Save revision
          </Button>
          <span className="text-xs text-muted-foreground">
            {mode === "manual" ? "Manual revision: it reschedules this version like any other." : "From your revision queue."}
          </span>
        </div>
      </form>
    </div>
  );
}
