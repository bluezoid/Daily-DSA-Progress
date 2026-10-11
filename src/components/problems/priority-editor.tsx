"use client";

import { useLayoutEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { PriorityBadge } from "@/components/common/badges";
import { api, errorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";

/** Click the priority badge to change or clear the score in place. */
export function PriorityEditor({ problemId, score, compact }: { problemId: string; score: number | null; compact?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(score);
  const [saving, setSaving] = useState(false);
  useLayoutEffect(() => () => setOpen(false), []);

  async function save(next: number | null) {
    const prev = value;
    setValue(next);
    setSaving(true);
    try {
      await api(`/api/problems/${problemId}`, { method: "PATCH", body: { priorityScore: next } });
      setOpen(false);
      router.refresh();
    } catch (err) {
      setValue(prev);
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="rounded-md focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          aria-label={`Change priority (currently ${value ?? "unranked"})`}
        >
          <PriorityBadge score={value} compact={compact} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="start">
        <p className="mb-2 text-sm font-medium">Priority</p>
        <div className="grid grid-cols-5 gap-1" role="group" aria-label="Priority score">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <Button
              key={n}
              type="button"
              size="sm"
              variant={value === n ? "default" : "outline"}
              disabled={saving}
              aria-pressed={value === n}
              onClick={() => save(n)}
              className={cn("tabular-nums")}
            >
              {n}
            </Button>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>1–3 low · 4–7 medium · 8–10 high</span>
        </div>
        <Button type="button" variant="ghost" size="sm" className="mt-1 w-full" disabled={saving || value == null} onClick={() => save(null)}>
          Clear (unranked)
        </Button>
      </PopoverContent>
    </Popover>
  );
}
