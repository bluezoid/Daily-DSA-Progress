import type { Metadata } from "next";
import Link from "next/link";
import { Import } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/page-header";
import { ProblemForm } from "@/components/problems/problem-form";
import { problemToFormValues } from "@/components/problems/problem-form-values";

export const metadata: Metadata = { title: "New problem" };

export default function NewProblemPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="New problem"
        description="Add a problem from any source. Only the title is required."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/problems/import">
              <Import aria-hidden /> Import from LeetCode
            </Link>
          </Button>
        }
      />
      <ProblemForm mode="create" initial={problemToFormValues({})} />
    </div>
  );
}
