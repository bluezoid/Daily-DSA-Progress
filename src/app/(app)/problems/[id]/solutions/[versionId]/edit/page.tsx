import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/common/page-header";
import { FormSkeleton } from "@/components/common/skeletons";
import { SolutionForm } from "@/components/solutions/solution-form";
import { requireUser } from "@/lib/auth/require-user";
import { ApiError } from "@/lib/http/errors";
import { getSolution } from "@/services/solutions/solution.service";

export const metadata: Metadata = { title: "Edit solution" };

type Params = Promise<{ id: string; versionId: string }>;

async function Content({ params }: { params: Params }) {
  const user = await requireUser();
  const { id, versionId } = await params;
  const s = await getSolution(user, versionId).catch((e) => {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  });
  if (s.problemId.toHexString() !== id) notFound();
  return (
    <>
      <PageHeader title="Edit solution" description={s.label} />
      <SolutionForm
        problemId={id}
        solutionId={versionId}
        initial={{
          programmingLanguage: s.programmingLanguage,
          label: s.label,
          code: s.code,
          approach: s.approach,
          timeComplexity: s.timeComplexity,
          spaceComplexity: s.spaceComplexity,
          personalNotes: s.personalNotes,
          isPreferred: s.isPreferred,
        }}
      />
    </>
  );
}

export default function EditSolutionPage(props: { params: Params }) {
  return (
    <div className="mx-auto max-w-3xl">
      <Suspense fallback={<FormSkeleton />}>
        <Content params={props.params} />
      </Suspense>
    </div>
  );
}
