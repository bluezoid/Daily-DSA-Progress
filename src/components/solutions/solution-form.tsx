"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { api, ApiClientError } from "@/lib/api-client";
import { SolutionFields, type SolutionValues } from "./solution-fields";

type Values = SolutionValues & { isPreferred: boolean };

export function SolutionForm({
  problemId,
  solutionId,
  initial,
}: {
  problemId: string;
  solutionId?: string;
  initial: Values;
}) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ defaultValues: initial });

  async function onSubmit(values: Values) {
    setFormError(null);
    try {
      if (solutionId) {
        const rest: Partial<Values> = { ...values };
        delete rest.isPreferred; // preferred is changed via its own endpoint
        await api(`/api/solutions/${solutionId}`, { method: "PATCH", body: rest });
        toast.success("Solution updated");
      } else {
        await api(`/api/problems/${problemId}/solutions`, { method: "POST", body: values });
        toast.success("Solution saved. First revision is due tomorrow.");
      }
      router.push(`/problems/${problemId}#solutions`);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) {
        for (const [k, m] of Object.entries(err.fields)) setError(k as keyof Values, { message: m[0] });
        setFormError(err.message);
      } else setFormError("Network error. Your code is still here. Try again.");
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit, () => setFormError("Fix the highlighted fields."))}
      className="grid gap-6 rounded-xl border bg-card p-4 sm:p-5"
      noValidate
    >
      <SolutionFields register={register} control={control} errors={errors} />
      {!solutionId && (
        <div className="flex items-center gap-2">
          <Controller
            control={control}
            name="isPreferred"
            render={({ field }) => <Checkbox id="isPreferred" checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />}
          />
          <Label htmlFor="isPreferred" className="font-normal">
            Mark as the preferred solution for this problem
          </Label>
        </div>
      )}
      {formError && (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
          {solutionId ? "Save changes" : "Save solution"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
