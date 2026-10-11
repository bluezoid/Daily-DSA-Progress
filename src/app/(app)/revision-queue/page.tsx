import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { ListSkeleton } from "@/components/common/skeletons";
import { EmptyState } from "@/components/common/empty-state";
import { QueueList } from "@/components/revisions/queue-list";
import { QueueSortSelect } from "@/components/revisions/queue-sort";
import { requireUser } from "@/lib/auth/require-user";
import { queueQuerySchema } from "@/lib/validations/revision";
import { getRevisionQueue } from "@/services/revisions/revision.service";

export const metadata: Metadata = { title: "Revision queue" };

type SP = Promise<Record<string, string | string[] | undefined>>;

async function Queue({ searchParams }: { searchParams: SP }) {
  const user = await requireUser();
  const sp = await searchParams;
  const { sort } = queueQuerySchema.parse({ sort: typeof sp.sort === "string" ? sp.sort : undefined, upcomingDays: 14 });
  const q = await getRevisionQueue(user, { sort, upcomingDays: 14 });
  const dueCount = q.overdue.length + q.today.length;

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {dueCount === 0 ? "Nothing due right now." : `${dueCount} revision${dueCount === 1 ? "" : "s"} due`}
          {q.overdue.length > 0 && `, ${q.overdue.length} overdue`}
        </p>
        <QueueSortSelect value={sort} />
      </div>
      {dueCount === 0 && q.upcoming.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="All caught up"
          description="Revisions appear here when a saved solution comes due. New solutions are first due the day after you save them."
        />
      ) : (
        <>
          <section className="grid gap-3">
            <h2 className="font-semibold">Overdue <span className="text-muted-foreground tabular-nums">({q.overdue.length})</span></h2>
            <QueueList items={q.overdue} emptyText="Nothing overdue." />
          </section>
          <section className="grid gap-3">
            <h2 className="font-semibold">Due today <span className="text-muted-foreground tabular-nums">({q.today.length})</span></h2>
            <QueueList items={q.today} emptyText="Nothing else due today." />
          </section>
          <section className="grid gap-3">
            <h2 className="font-semibold">Upcoming, next 14 days <span className="text-muted-foreground tabular-nums">({q.upcoming.length})</span></h2>
            <QueueList items={q.upcoming} emptyText="Nothing scheduled in the next two weeks." />
          </section>
        </>
      )}
    </div>
  );
}

export default function RevisionQueuePage(props: { searchParams: SP }) {
  return (
    <>
      <PageHeader title="Revision queue" description="Each solution version is its own revision task, scheduled by your timezone." />
      <Suspense fallback={<ListSkeleton />}>
        <Queue searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
