import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { ImportFlow } from "@/components/problems/import-flow";

export const metadata: Metadata = { title: "Import from LeetCode" };

export default function ImportPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Import from LeetCode" description="Paste a problem URL, check what was extracted, then save." />
      <ImportFlow />
    </div>
  );
}
