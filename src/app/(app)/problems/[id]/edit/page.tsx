import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/common/page-header";
import { ProblemForm } from "@/components/problems/problem-form";
import { problemToFormValues } from "@/components/problems/problem-form-values";
import { FormSkeleton } from "@/components/common/skeletons";
import { requireUser } from "@/lib/auth/require-user";
import { toProblemDTO } from "@/lib/mappers";
import { getProblem } from "@/services/problems/problem.service";
import { ApiError } from "@/lib/http/errors";

export const metadata: Metadata = { title: "Edit problem" };

async function EditContent({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const problem = await getProblem(user, id).catch((e) => {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  });
  return (
    <>
      <PageHeader title="Edit problem" description={problem.title} />
      <ProblemForm mode="edit" problemId={id} initial={problemToFormValues(toProblemDTO(problem))} />
    </>
  );
}

export default function EditProblemPage(props: { params: Promise<{ id: string }> }) {
  return (
    <div className="mx-auto max-w-3xl">
      <Suspense fallback={<FormSkeleton />}>
        <EditContent params={props.params} />
      </Suspense>
    </div>
  );
}
