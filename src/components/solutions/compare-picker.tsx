"use client";

import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function ComparePicker({
  problemId,
  options,
  a,
  b,
}: {
  problemId: string;
  options: { id: string; label: string }[];
  a: string;
  b: string;
}) {
  const router = useRouter();
  const go = (na: string, nb: string) => router.replace(`/problems/${problemId}/compare?a=${na}&b=${nb}`);
  const picker = (value: string, onChange: (v: string) => void, label: string) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {picker(a, (v) => go(v, b), "Left version")}
      {picker(b, (v) => go(a, v), "Right version")}
    </div>
  );
}
