import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Code2, Import, ListTodo, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/page-header";
import { PageSkeleton } from "@/components/common/skeletons";
import { DifficultyBadge, LanguageBadge, PriorityBadge } from "@/components/common/badges";
import { BarChartCard } from "@/components/dashboard/bar-chart-card";
import { QueueList } from "@/components/revisions/queue-list";
import { requireUser } from "@/lib/auth/require-user";
import { DIFFICULTY_LABELS, OUTCOME_LABELS, SOURCE_LABELS, STATUS_LABELS } from "@/lib/constants";
import { dueLabel, formatDate } from "@/lib/format";
import { getDashboard } from "@/services/dashboard/dashboard.service";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

function Stat({ label, value, hint, href, tone }: { label: string; value: number; hint?: string; href?: string; tone?: "alert" }) {
  const body = (
    <>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold tabular-nums", tone === "alert" && value > 0 && "text-rose-600 dark:text-rose-400")}>
        {value.toLocaleString()}
      </p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </>
  );
  const cls = "rounded-xl border bg-card p-4";
  return href ? (
    <Link href={href} className={cn(cls, "transition-colors hover:border-primary/40 hover:bg-muted/30")}>{body}</Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

async function Dashboard() {
  const user = await requireUser();
  const d = await getDashboard(user);
  const m = d.metrics;
  const tz = user.timezone;

  if (m.totalProblems === 0) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center">
        <h2 className="text-lg font-semibold">Welcome, {user.name.split(" ")[0]}</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          Start by importing a LeetCode problem or adding one from anywhere. Save a solution and it lands in your revision queue tomorrow.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button asChild><Link href="/problems/import"><Import aria-hidden /> Import from LeetCode</Link></Button>
          <Button asChild variant="outline"><Link href="/problems/new"><Plus aria-hidden /> Add manually</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Due today" value={m.dueToday} hint="solution versions" href="/revision-queue" />
        <Stat label="Overdue" value={m.overdue} hint="solution versions" href="/revision-queue" tone="alert" />
        <Stat label="High priority due" value={m.highPriorityDue} hint="priority 8–10, due or overdue" href="/problems?priorityBand=high&revision=overdue,due_today" tone="alert" />
        <Stat label="Total problems" value={m.totalProblems} href="/problems" />
        <Stat label="Solution versions" value={m.totalSolutions} />
        <Stat label="Solved" value={m.solved} hint="marked Solved by you" href="/problems?status=solved" />
        <Stat label="Unsolved" value={m.unsolved} hint="Todo + Attempted" href="/problems?status=todo,attempted" />
        <Stat label="Attempted" value={m.attempted} href="/problems?status=attempted" />
        <Stat label="Needs revision" value={m.needsRevisionStatus} hint={`status label · ${m.problemsWithOverdue} with overdue versions`} href="/problems?status=needs_revision" />
        <Stat label="High priority" value={m.highPriority} hint="priority 8–10" href="/problems?priorityBand=high&sort=priority_desc" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Overdue revisions" action={<Link href="/revision-queue" className="text-xs text-primary hover:underline">Open queue</Link>}>
          <QueueList items={d.overdueRevisions} emptyText="Nothing overdue. Nice." />
        </Panel>
        <Panel title="Up next" action={<Link href="/revision-queue" className="text-xs text-primary hover:underline">Open queue</Link>}>
          <QueueList items={d.upcomingRevisions} emptyText="Nothing due in the next week." />
        </Panel>
      </div>

      <BarChartCard
        title="Revision activity"
        description={`Revisions per day, last 30 days · ${d.revisionTotals.total} total${d.revisionTotals.averageConfidence ? ` · average confidence ${d.revisionTotals.averageConfidence.toFixed(1)}/5` : ""}`}
        data={d.charts.activity.map((a) => ({ label: a.date.slice(5), value: a.count }))}
        valueLabel="Revisions"
        labelEvery={5}
        showValues={false}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <BarChartCard title="Problems by difficulty" layout="bar" data={d.charts.byDifficulty.map((x) => ({ label: DIFFICULTY_LABELS[x.key], value: x.count }))} />
        <BarChartCard title="Problems by status" layout="bar" data={d.charts.byStatus.map((x) => ({ label: STATUS_LABELS[x.key], value: x.count }))} />
        <BarChartCard title="Priority distribution" description="Your 1–10 score; unranked shown separately" data={d.charts.priority.map((x) => ({ label: x.key === "unranked" ? "None" : x.key, value: x.count }))} />
        <BarChartCard title="Problems by source" layout="bar" data={d.charts.bySource.map((x) => ({ label: SOURCE_LABELS[x.key], value: x.count }))} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Recently added" action={<Link href="/problems" className="text-xs text-primary hover:underline">All problems</Link>}>
          <ul className="grid gap-2">
            {d.recentProblems.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2">
                <Link href={`/problems/${p.id}`} className="min-w-0 truncate text-sm hover:text-primary hover:underline">{p.title}</Link>
                <DifficultyBadge difficulty={p.difficulty} />
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="High priority" action={<Link href="/problems?priorityBand=high&sort=priority_desc" className="text-xs text-primary hover:underline">View all</Link>}>
          {d.highPriorityProblems.length === 0 ? (
            <p className="text-sm text-muted-foreground">No problems with priority 8 or higher.</p>
          ) : (
            <ul className="grid gap-2">
              {d.highPriorityProblems.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/problems/${p.id}`} className="block truncate text-sm hover:text-primary hover:underline">{p.title}</Link>
                    <span className="text-[11px] text-muted-foreground">{dueLabel(p.nextRevisionAt, tz)}</span>
                  </div>
                  <PriorityBadge score={p.priorityScore} compact />
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Recently revised">
          {d.recentRevisions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No revisions yet.</p>
          ) : (
            <ul className="grid gap-2">
              {d.recentRevisions.map((r) => (
                <li key={r.id} className="text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <Link href={`/problems/${r.problemId}`} className="min-w-0 truncate hover:text-primary hover:underline">{r.problemTitle}</Link>
                    <LanguageBadge language={r.programmingLanguage} />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {OUTCOME_LABELS[r.outcome]} · {r.confidence}/5 · {formatDate(r.revisedAt, tz)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Your library and revision schedule at a glance."
        actions={
          <>
            <Button asChild size="sm"><Link href="/revision-queue"><ListTodo aria-hidden /> Revision queue</Link></Button>
            <Button asChild size="sm" variant="outline"><Link href="/problems/import"><Import aria-hidden /> Import</Link></Button>
            <Button asChild size="sm" variant="outline"><Link href="/problems/new"><Plus aria-hidden /> New problem</Link></Button>
            <Button asChild size="sm" variant="outline"><Link href="/problems?solutions=none"><Code2 aria-hidden /> Add a solution</Link></Button>
          </>
        }
      />
      <Suspense fallback={<PageSkeleton />}>
        <Dashboard />
      </Suspense>
    </>
  );
}
