"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STATUSES, STATUS_LABELS, type ProblemStatus } from "@/lib/constants";
import { api, errorMessage } from "@/lib/api-client";

export function StatusEditor({ problemId, status }: { problemId: string; status: ProblemStatus }) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  return (
    <Select
      value={value}
      onValueChange={async (v) => {
        const prev = value;
        setValue(v as ProblemStatus);
        try {
          await api(`/api/problems/${problemId}`, { method: "PATCH", body: { status: v } });
          toast.success(`Marked as ${STATUS_LABELS[v as ProblemStatus]}`);
          router.refresh();
        } catch (err) {
          setValue(prev);
          toast.error(errorMessage(err));
        }
      }}
    >
      <SelectTrigger size="sm" aria-label="Problem status" className="h-7 w-auto gap-1 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            {STATUS_LABELS[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
