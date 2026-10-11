"use client";

import Link from "next/link";
import { useLayoutEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Star, StarOff, Trash2, Brain } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDelete } from "@/components/common/confirm-delete";
import { api, errorMessage } from "@/lib/api-client";

export function SolutionActions({
  problemId,
  solutionId,
  label,
  isPreferred,
}: {
  problemId: string;
  solutionId: string;
  label: string;
  isPreferred: boolean;
}) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  useLayoutEffect(() => () => setConfirm(false), []);

  async function togglePreferred() {
    setBusy(true);
    try {
      await api(`/api/solutions/${solutionId}/preferred`, { method: "POST", body: { preferred: !isPreferred } });
      toast.success(isPreferred ? "Preferred mark removed" : "Marked as preferred solution");
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild size="sm">
        <Link href={`/revise/${solutionId}?mode=manual`}>
          <Brain aria-hidden /> Revise now
        </Link>
      </Button>
      <Button size="sm" variant="outline" onClick={togglePreferred} disabled={busy}>
        {isPreferred ? <StarOff aria-hidden /> : <Star aria-hidden />}
        {isPreferred ? "Unmark preferred" : "Mark preferred"}
      </Button>
      <Button asChild size="sm" variant="outline">
        <Link href={`/problems/${problemId}/solutions/${solutionId}/edit`}>
          <Pencil aria-hidden /> Edit
        </Link>
      </Button>
      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirm(true)}>
        <Trash2 aria-hidden /> Delete
      </Button>
      <ConfirmDelete
        open={confirm}
        onOpenChange={setConfirm}
        endpoint={`/api/solutions/${solutionId}`}
        title={`Delete “${label}”?`}
        description="This deletes this solution version and its revision history. Other versions are not affected."
        successMessage="Solution deleted"
      />
    </div>
  );
}
