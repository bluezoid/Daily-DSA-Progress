import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { PageSkeleton } from "@/components/common/skeletons";
import { CodeBlock } from "@/components/common/code-block";
import { LanguageBadge, PreferredBadge } from "@/components/common/badges";
import { ComparePicker } from "@/components/solutions/compare-picker";
import { requireUser } from "@/lib/auth/require-user";
import { getProblem } from "@/services/problems/problem.service";
import { listSolutions } from "@/services/solutions/solution.service";
import { ApiError } from "@/lib/http/errors";
import { formatDate } from "@/lib/format";
import { toSolutionDTO } from "@/lib/mappers";
import type { SolutionVersionDTO } from "@/types/domain";

export const metadata: Metadata = { title: "Compare solutions" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

function Column({ s, timezone }: { s: SolutionVersionDTO; timezone: string }) {
  return (
    <div className="grid min-w-0 content-start gap-3 rounded-xl border bg-card p-4">
      <div>
        <h2 className="font-medium">{s.label}</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          <LanguageBadge language={s.programmingLanguage} />
          {s.isPreferred && <PreferredBadge />}
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div><dt className="text-xs text-muted-foreground">Time</dt><dd className="font-mono">{s.timeComplexity || "—"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Space</dt><dd className="font-mono">{s.spaceComplexity || "—"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Revisions</dt><dd>{s.revisionCount}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Updated</dt><dd>{formatDate(s.updatedAt, timezone)}</dd></div>
      </dl>
      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">Approach</p>
        <p className="text-sm whitespace-pre-wrap">{s.approach || "—"}</p>
      </div>
      <CodeBlock code={s.code} language={s.programmingLanguage} />
      {s.personalNotes && (
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Notes</p>
          <p className="text-sm whitespace-pre-wrap">{s.personalNotes}</p>
        </div>
      )}
    </div>
  );
}

async function Compare({ params, searchParams }: Props) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const problem = await getProblem(user, id).catch((e) => {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  });
  const solutions = (await listSolutions(user, id)).map(toSolutionDTO);
  const back = (
    <Link href={`/problems/${id}`} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4" aria-hidden /> {problem.title}
    </Link>
  );
  if (solutions.length < 2) {
    return (
      <>
        {back}
        <PageHeader title="Compare solutions" description="Add at least two solution versions to compare them." />
      </>
    );
  }
  const find = (v: unknown, fallback: number) => solutions.find((s) => s.id === v) ?? solutions[fallback];
  const a = find(sp.a, 0);
  const b = find(sp.b, a.id === solutions[1].id ? 0 : 1);
  return (
    <>
      {back}
      <PageHeader title="Compare solutions" description="Two versions side by side." />
      <div className="grid gap-4">
        <ComparePicker problemId={id} options={solutions.map((s) => ({ id: s.id, label: s.label }))} a={a.id} b={b.id} />
        <div className="grid gap-4 lg:grid-cols-2">
          <Column s={a} timezone={user.timezone} />
          <Column s={b} timezone={user.timezone} />
        </div>
      </div>
    </>
  );
}

export default function ComparePage(props: Props) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Compare {...props} />
    </Suspense>
  );
}
