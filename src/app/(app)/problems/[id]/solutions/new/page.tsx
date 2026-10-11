import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/common/page-header";
import { FormSkeleton } from "@/components/common/skeletons";
import { SolutionForm } from "@/components/solutions/solution-form";
import { emptySolution } from "@/components/problems/problem-form-values";
import { requireUser } from "@/lib/auth/require-user";
import { ApiError } from "@/lib/http/errors";
import { getProblem } from "@/services/problems/problem.service";

export const metadata: Metadata = { title: "Add solution" };

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const problem = await getProblem(user, id).catch((e) => {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  });
  return (
    <>
      <PageHeader title="Add solution" description={problem.title} />
      <SolutionForm problemId={id} initial={{ ...emptySolution, isPreferred: problem.solutionCount === 0 }} />
    </>
  );
}

export default function NewSolutionPage(props: { params: Promise<{ id: string }> }) {
  return (
    <div className="mx-auto max-w-3xl">
      <Suspense fallback={<FormSkeleton />}>
        <Content params={props.params} />
      </Suspense>
    </div>
  );
}
