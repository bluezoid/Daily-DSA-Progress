import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageSkeleton } from "@/components/common/skeletons";
import { StatementView } from "@/components/common/statement-view";
import { ExampleList } from "@/components/common/example-list";
import { CodeBlock } from "@/components/common/code-block";
import { DifficultyBadge, DueBadge, LanguageBadge, PriorityBadge } from "@/components/common/badges";
import { RevisionWorkspace } from "@/components/revisions/revision-workspace";
import { requireUser } from "@/lib/auth/require-user";
import { ApiError } from "@/lib/http/errors";
import { dueLabel, dueTone } from "@/lib/format";
import { getProblem } from "@/services/problems/problem.service";
import { getSolution } from "@/services/solutions/solution.service";

export const metadata: Metadata = { title: "Revise" };

type Props = { params: Promise<{ versionId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

async function Revise({ params, searchParams }: Props) {
  const user = await requireUser();
  const { versionId } = await params;
  const sp = await searchParams;
  const s = await getSolution(user, versionId).catch((e) => {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  });
  const p = await getProblem(user, s.problemId.toHexString());
  const mode = sp.mode === "scheduled" ? "scheduled" : "manual";
  const tz = user.timezone;

  return (
    <div className="grid gap-6">
      <div>
        <Link href={mode === "scheduled" ? "/revision-queue" : `/problems/${p._id.toHexString()}`} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden /> {mode === "scheduled" ? "Revision queue" : p.title}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{p.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Revising: {s.label}</span>
          <LanguageBadge language={s.programmingLanguage} />
          <DifficultyBadge difficulty={p.difficulty} />
          <PriorityBadge score={p.priorityScore} />
          <DueBadge tone={dueTone(s.nextRevisionAt, tz)} label={dueLabel(s.nextRevisionAt, tz)} />
        </div>
      </div>

      <section className="rounded-xl border bg-card p-4 sm:p-5">
        <h2 className="mb-3 font-medium">Problem</h2>
        {p.statement ? (
          <StatementView statement={p.statement} format={p.statementFormat} />
        ) : (
          <p className="text-sm text-muted-foreground">No statement saved for this problem.</p>
        )}
        {p.examples.length > 0 && (
          <div className="mt-4">
            <ExampleList examples={p.examples} />
          </div>
        )}
        {p.constraints.length > 0 && (
          <ul className="mt-4 list-disc space-y-1 pl-5 font-mono text-[13px]">{p.constraints.map((c, i) => <li key={i}>{c}</li>)}</ul>
        )}
      </section>

      <RevisionWorkspace
        solutionId={s._id.toHexString()}
        problemId={p._id.toHexString()}
        mode={mode}
        timezone={tz}
        solutionPanel={
          <div className="grid gap-3">
            {s.approach && <p className="text-sm whitespace-pre-wrap"><span className="font-medium">Approach:</span> {s.approach}</p>}
            <p className="text-sm text-muted-foreground">
              Time <span className="font-mono text-foreground">{s.timeComplexity || "—"}</span> · Space{" "}
              <span className="font-mono text-foreground">{s.spaceComplexity || "—"}</span>
            </p>
            <CodeBlock code={s.code} language={s.programmingLanguage} />
          </div>
        }
      />
    </div>
  );
}

export default function RevisePage(props: Props) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Revise {...props} />
    </Suspense>
  );
}
