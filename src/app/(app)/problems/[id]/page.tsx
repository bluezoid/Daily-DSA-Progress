import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft, Code2, ExternalLink, GitCompare, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DifficultyBadge, DueBadge, LanguageBadge, PreferredBadge, SourceBadge, TopicChip } from "@/components/common/badges";
import { StatementView } from "@/components/common/statement-view";
import { ExampleList, ProblemImg } from "@/components/common/example-list";
import { CodeBlock } from "@/components/common/code-block";
import { EmptyState } from "@/components/common/empty-state";
import { PageSkeleton } from "@/components/common/skeletons";
import { PriorityEditor } from "@/components/problems/priority-editor";
import { StatusEditor } from "@/components/problems/status-editor";
import { DeleteProblemButton } from "@/components/problems/delete-problem-button";
import { SolutionActions } from "@/components/solutions/solution-actions";
import { RevisionHistory } from "@/components/revisions/revision-history";
import { requireUser } from "@/lib/auth/require-user";
import { ApiError } from "@/lib/http/errors";
import { toProblemDTO, toRevisionDTO, toSolutionDTO } from "@/lib/mappers";
import { dueLabel, dueTone, formatDate } from "@/lib/format";
import { getProblem } from "@/services/problems/problem.service";
import { listSolutions } from "@/services/solutions/solution.service";
import { getRevisionHistory } from "@/services/revisions/revision.service";

export const metadata: Metadata = { title: "Problem" };

type Params = Promise<{ id: string }>;

function Section({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="rounded-xl border bg-card p-4 sm:p-5">
      <h2 className="mb-3 font-medium">{title}</h2>
      {children}
    </section>
  );
}

async function ProblemDetail({ params }: { params: Params }) {
  const user = await requireUser();
  const { id } = await params;
  const doc = await getProblem(user, id).catch((e) => {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  });
  const [solutionDocs, history] = await Promise.all([listSolutions(user, id), getRevisionHistory(user, { problemId: id }, 100)]);
  const p = toProblemDTO(doc);
  const solutions = solutionDocs.map(toSolutionDTO);
  const revisions = history.map(toRevisionDTO);
  const tz = user.timezone;
  const now = new Date();
  const labels = Object.fromEntries(solutions.map((s) => [s.id, s.label]));
  // Images not already shown in the statement or inside an example.
  const exampleImageUrls = new Set(p.examples.flatMap((ex) => (ex.images ?? []).map((img) => img.url)));
  const extraImages = p.images.filter((img) => !p.statement.includes(img.url) && !exampleImageUrls.has(img.url));
  const hasDetails = p.statement || p.examples.length || p.constraints.length || p.followUps.length || extraImages.length;

  return (
    <div className="grid gap-6">
      <div>
        <Link href="/problems" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden /> Problems
        </Link>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-balance">
              {p.problemNumber && <span className="mr-2 text-muted-foreground tabular-nums">{p.problemNumber}.</span>}
              {p.title}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <SourceBadge sourceType={p.sourceType} sourceName={p.sourceName} />
              <DifficultyBadge difficulty={p.difficulty} />
              <StatusEditor problemId={p.id} status={p.status} />
              <PriorityEditor problemId={p.id} score={p.priorityScore} />
              <DueBadge tone={dueTone(p.nextRevisionAt, tz, now)} label={dueLabel(p.nextRevisionAt, tz, now)} />
              {p.sourceUrl && (
                <a
                  href={p.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
                >
                  Open source <ExternalLink className="size-3.5" aria-hidden />
                </a>
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Added {formatDate(p.createdAt, tz)} · Updated {formatDate(p.updatedAt, tz)}
              {p.importedAt && " · Imported from LeetCode"}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={`/problems/${p.id}/edit`}>
                <Pencil aria-hidden /> Edit
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href={`/problems/${p.id}/solutions/new`}>
                <Plus aria-hidden /> Add solution
              </Link>
            </Button>
            {solutions.length >= 2 && (
              <Button asChild size="sm" variant="outline">
                <Link href={`/problems/${p.id}/compare?a=${solutions[0].id}&b=${solutions[1].id}`}>
                  <GitCompare aria-hidden /> Compare
                </Link>
              </Button>
            )}
            <DeleteProblemButton id={p.id} title={p.title} />
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="grid min-w-0 gap-6">
          <Section title="Problem">
            {hasDetails ? (
              <div className="grid gap-5">
                <StatementView statement={p.statement} format={p.statementFormat} />
                <ExampleList examples={p.examples} />
                {p.constraints.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-sm font-medium">Constraints</p>
                    <ul className="list-disc space-y-1 pl-5 font-mono text-[13px]">
                      {p.constraints.map((c, i) => <li key={i}>{c}</li>)}
                    </ul>
                  </div>
                )}
                {p.followUps.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-sm font-medium">Follow-up</p>
                    <ul className="list-disc space-y-1 pl-5 text-sm">
                      {p.followUps.map((f, i) => <li key={i}>{f}</li>)}
                    </ul>
                  </div>
                )}
                {extraImages.length > 0 && (
                  <div className="flex flex-wrap gap-3">
                    {extraImages.map((img) => (
                      <ProblemImg key={img.url} img={img} fallbackAlt={`Illustration for ${p.title}`} />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No statement saved. <Link className="text-primary hover:underline" href={`/problems/${p.id}/edit`}>Add one</Link> if you want it here.
              </p>
            )}
          </Section>

          <section id="solutions" className="grid gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Solutions</h2>
              <span className="text-sm text-muted-foreground">{solutions.length} version{solutions.length === 1 ? "" : "s"}</span>
            </div>
            {solutions.length === 0 ? (
              <EmptyState
                icon={Code2}
                title="No solutions yet"
                description="Save your first solution to start its revision schedule."
                action={
                  <Button asChild>
                    <Link href={`/problems/${p.id}/solutions/new`}><Plus aria-hidden /> Add first solution</Link>
                  </Button>
                }
              />
            ) : (
              <Tabs defaultValue={solutions[0].id} className="gap-3">
                <div className="overflow-x-auto">
                  <TabsList className="h-auto w-max">
                    {solutions.map((s) => (
                      <TabsTrigger key={s.id} value={s.id} className="gap-1.5">
                        {s.isPreferred && <span aria-label="Preferred">★</span>}
                        {s.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>
                {solutions.map((s) => {
                  const own = revisions.filter((r) => r.solutionVersionId === s.id);
                  return (
                    <TabsContent key={s.id} value={s.id} className="grid gap-4 rounded-xl border bg-card p-4 sm:p-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <LanguageBadge language={s.programmingLanguage} />
                        {s.isPreferred && <PreferredBadge />}
                        <DueBadge tone={dueTone(s.nextRevisionAt, tz, now)} label={dueLabel(s.nextRevisionAt, tz, now)} />
                      </div>
                      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                        <div><dt className="text-xs text-muted-foreground">Time</dt><dd className="font-mono">{s.timeComplexity || "—"}</dd></div>
                        <div><dt className="text-xs text-muted-foreground">Space</dt><dd className="font-mono">{s.spaceComplexity || "—"}</dd></div>
                        <div><dt className="text-xs text-muted-foreground">Revisions</dt><dd className="tabular-nums">{s.revisionCount}</dd></div>
                        <div><dt className="text-xs text-muted-foreground">Last revised</dt><dd>{formatDate(s.lastRevisedAt, tz)}</dd></div>
                      </dl>
                      {s.approach && (
                        <div>
                          <p className="mb-1 text-xs font-medium text-muted-foreground">Approach</p>
                          <p className="text-sm whitespace-pre-wrap">{s.approach}</p>
                        </div>
                      )}
                      <CodeBlock code={s.code} language={s.programmingLanguage} />
                      {s.personalNotes && (
                        <div>
                          <p className="mb-1 text-xs font-medium text-muted-foreground">Notes</p>
                          <p className="text-sm whitespace-pre-wrap">{s.personalNotes}</p>
                        </div>
                      )}
                      <SolutionActions problemId={p.id} solutionId={s.id} label={s.label} isPreferred={s.isPreferred} />
                      <div>
                        <p className="mb-2 text-sm font-medium">Revision history for this version</p>
                        <RevisionHistory items={own} timezone={tz} />
                      </div>
                    </TabsContent>
                  );
                })}
              </Tabs>
            )}
          </section>

          {revisions.length > 0 && solutions.length > 1 && (
            <Section title="All revisions">
              <RevisionHistory items={revisions} timezone={tz} versionLabels={labels} />
            </Section>
          )}
        </div>

        <aside className="grid content-start gap-6">
          <Section title="Topics">
            {p.topics.length ? (
              <div className="flex flex-wrap gap-1.5">{p.topics.map((t) => <TopicChip key={t} topic={t} />)}</div>
            ) : (
              <p className="text-sm text-muted-foreground">No topics.</p>
            )}
          </Section>
          <Section title="Personal notes">
            {p.personalNotes ? <p className="text-sm whitespace-pre-wrap">{p.personalNotes}</p> : <p className="text-sm text-muted-foreground">No notes.</p>}
          </Section>
          {p.similarProblems.length > 0 && (
            <Section title="Similar problems">
              <ul className="space-y-1 text-sm">{p.similarProblems.map((s) => <li key={s}>{s}</li>)}</ul>
            </Section>
          )}
        </aside>
      </div>
    </div>
  );
}

export default function ProblemPage(props: { params: Params }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ProblemDetail params={props.params} />
    </Suspense>
  );
}
