import { CircleDashed, CircleDot, CheckCircle2, RotateCcw, Star, Clock, AlertTriangle, CalendarClock, CalendarOff } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DIFFICULTY_LABELS,
  LANGUAGE_LABELS,
  SOURCE_LABELS,
  STATUS_LABELS,
  priorityBand,
  type Difficulty,
  type Language,
  type ProblemStatus,
  type SourceType,
} from "@/lib/constants";

const pill = "inline-flex h-6 items-center gap-1 rounded-md border px-2 text-xs font-medium whitespace-nowrap";

const DIFF_STYLE: Record<Difficulty, string> = {
  easy: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  medium: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  hard: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400",
  unknown: "border-border bg-muted text-muted-foreground",
};

export function DifficultyBadge({ difficulty, className }: { difficulty: Difficulty; className?: string }) {
  return (
    <span className={cn(pill, DIFF_STYLE[difficulty], className)} title="Difficulty">
      {DIFFICULTY_LABELS[difficulty]}
    </span>
  );
}

const STATUS_STYLE: Record<ProblemStatus, { cls: string; Icon: typeof CircleDot }> = {
  todo: { cls: "bg-muted text-muted-foreground", Icon: CircleDashed },
  attempted: { cls: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400", Icon: CircleDot },
  solved: { cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", Icon: CheckCircle2 },
  needs_revision: { cls: "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-400", Icon: RotateCcw },
};

export function StatusBadge({ status, className }: { status: ProblemStatus; className?: string }) {
  const { cls, Icon } = STATUS_STYLE[status];
  return (
    <span className={cn(pill, cls, className)} title="Status">
      <Icon className="size-3.5" aria-hidden />
      {STATUS_LABELS[status]}
    </span>
  );
}

const BAND_LABEL = { low: "Low", medium: "Medium", high: "High", unranked: "Unranked" } as const;

export function PriorityBadge({ score, className, compact }: { score: number | null; className?: string; compact?: boolean }) {
  const band = priorityBand(score);
  const label = score == null ? "Unranked priority" : `Priority ${score} of 10, ${BAND_LABEL[band].toLowerCase()}`;
  const cls =
    band === "high"
      ? "border-primary/40 bg-primary/10 text-primary"
      : band === "medium"
        ? "border-border bg-secondary text-secondary-foreground"
        : band === "low"
          ? "border-border bg-background text-muted-foreground"
          : "border-dashed border-border bg-background text-muted-foreground";
  return (
    <span className={cn(pill, "tabular-nums", cls, className)} aria-label={label} title={label}>
      <span aria-hidden className="flex items-end gap-px">
        {[1, 2, 3].map((bar) => (
          <span
            key={bar}
            className={cn(
              "w-[3px] rounded-[1px]",
              bar === 1 ? "h-1.5" : bar === 2 ? "h-2.5" : "h-3.5",
              (band === "low" && bar === 1) || (band === "medium" && bar <= 2) || band === "high" ? "bg-current" : "bg-current/20",
            )}
          />
        ))}
      </span>
      <span aria-hidden>{score == null ? "—" : `P${score}`}</span>
      {!compact && <span aria-hidden className="font-normal opacity-80">{BAND_LABEL[band]}</span>}
    </span>
  );
}

export function SourceBadge({ sourceType, sourceName, className }: { sourceType: SourceType; sourceName: string; className?: string }) {
  return (
    <span className={cn(pill, "bg-background text-muted-foreground", className)} title="Source">
      {sourceName || SOURCE_LABELS[sourceType]}
    </span>
  );
}

export function LanguageBadge({ language, className }: { language: Language; className?: string }) {
  return <span className={cn(pill, "bg-muted font-mono text-[11px] text-foreground", className)}>{LANGUAGE_LABELS[language]}</span>;
}

export function PreferredBadge() {
  return (
    <span className={cn(pill, "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400")}>
      <Star className="size-3.5 fill-current" aria-hidden />
      Preferred
    </span>
  );
}

export function DueBadge({ tone, label }: { tone: "overdue" | "today" | "upcoming" | "none"; label: string }) {
  const map = {
    overdue: { cls: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400", Icon: AlertTriangle },
    today: { cls: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400", Icon: Clock },
    upcoming: { cls: "bg-background text-muted-foreground", Icon: CalendarClock },
    none: { cls: "border-dashed bg-background text-muted-foreground", Icon: CalendarOff },
  }[tone];
  return (
    <span className={cn(pill, map.cls)}>
      <map.Icon className="size-3.5" aria-hidden />
      {label}
    </span>
  );
}

export function TopicChip({ topic }: { topic: string }) {
  return <span className="inline-flex h-5 items-center rounded bg-muted px-1.5 text-[11px] text-muted-foreground">{topic}</span>;
}
