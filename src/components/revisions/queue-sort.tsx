"use client";

import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QUEUE_SORTS, QUEUE_SORT_LABELS, type QueueSort } from "@/lib/constants";

export function QueueSortSelect({ value }: { value: QueueSort }) {
  const router = useRouter();
  return (
    <Select value={value} onValueChange={(v) => router.push(v === "most_overdue" ? "/revision-queue" : `/revision-queue?sort=${v}`)}>
      <SelectTrigger className="w-52" aria-label="Sort revision tasks">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {QUEUE_SORTS.map((s) => (
          <SelectItem key={s} value={s}>
            {QUEUE_SORT_LABELS[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
