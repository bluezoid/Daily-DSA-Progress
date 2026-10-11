"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useFieldArray, useForm, useWatch, type FieldErrors } from "react-hook-form";
import { AlertTriangle, ChevronDown, ImageOff, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field } from "@/components/common/field";
import { SolutionFields } from "@/components/solutions/solution-fields";
import {
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  SOURCE_LABELS,
  SOURCE_TYPES,
  STATUSES,
  STATUS_LABELS,
} from "@/lib/constants";
import { api, ApiClientError } from "@/lib/api-client";
import type { ProblemDTO } from "@/types/domain";
import { FIELD_LABELS, type ProblemFormValues } from "./problem-form-values";

export { problemToFormValues, type ProblemFormValues } from "./problem-form-values";

const lines = (s: string) =>
  s
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

function toBody(v: ProblemFormValues) {
  return {
    title: v.title,
    sourceType: v.sourceType,
    sourceName: v.sourceType === "other" ? v.sourceName : "",
    sourceUrl: v.sourceUrl.trim() || null,
    problemNumber: v.problemNumber.trim() || null,
    sourceProblemId: v.sourceProblemId.trim() || null,
    slug: v.slug.trim() || null,
    difficulty: v.difficulty,
    status: v.status,
    priorityScore: v.priority ? Number(v.priority) : null,
    topics: v.topics
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    statement: v.statement,
    statementFormat: v.statementFormat,
    examples: v.examples.filter((e) => e.input.trim() || e.output.trim() || e.explanation.trim()),
    constraints: lines(v.constraints),
    followUps: lines(v.followUps),
    similarProblems: lines(v.similarProblems),
    images: v.images,
    personalNotes: v.personalNotes,
  };
}

type Mode = "create" | "edit" | "import";

export function ProblemForm({
  mode,
  initial,
  problemId,
  importInfo,
}: {
  mode: Mode;
  initial: ProblemFormValues;
  problemId?: string;
  importInfo?: { missingFields: string[]; previewHtml: string };
}) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<{ id: string; title: string } | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setError,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<ProblemFormValues>({ defaultValues: initial });
  const examples = useFieldArray({ control, name: "examples" });
  const images = useFieldArray({ control, name: "images" });
  const sourceType = useWatch({ control, name: "sourceType" });
  const includeSolution = useWatch({ control, name: "includeSolution" });
  const statementFormat = useWatch({ control, name: "statementFormat" });

  function applyFieldErrors(fields: Record<string, string[]>) {
    for (const [key, messages] of Object.entries(fields)) {
      const path = key === "priorityScore" ? "priority" : key.startsWith("initialSolution.") ? key.replace("initialSolution.", "solution.") : key;
      setError(path as keyof ProblemFormValues, { message: messages[0] });
    }
  }

  async function submit(values: ProblemFormValues, allowDuplicate = false) {
    setFormError(null);
    const body = toBody(values);
    try {
      if (mode === "edit") {
        await api(`/api/problems/${problemId}`, { method: "PATCH", body });
        toast.success("Problem updated");
        router.push(`/problems/${problemId}`);
        router.refresh();
        return;
      }
      const res = await api<{ problem: ProblemDTO }>("/api/problems", {
        method: "POST",
        body: {
          ...body,
          allowDuplicate,
          initialSolution: values.includeSolution ? values.solution : null,
          importMeta: mode === "import" ? { missingFields: importInfo?.missingFields ?? [] } : null,
        },
      });
      toast.success("Problem saved");
      router.push(`/problems/${res.problem.id}`);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.code === "DUPLICATE") {
          setDuplicate({ id: String(err.details.existingId), title: String(err.details.existingTitle) });
          return;
        }
        applyFieldErrors(err.fields);
        setFormError(err.message);
      } else setFormError("Network error. Your input is still here. Try again.");
    }
  }

  const onInvalid = (errs: FieldErrors<ProblemFormValues>) => {
    if (Object.keys(errs).length) setFormError("Fix the highlighted fields.");
  };

  return (
    <form onSubmit={handleSubmit((v) => submit(v), onInvalid)} className="grid gap-6" noValidate>
      {importInfo && importInfo.missingFields.length > 0 && (
        <div className="flex gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
          <div>
            <p className="font-medium">Some fields were not found in the source</p>
            <p className="mt-0.5 text-muted-foreground">
              {importInfo.missingFields.map((f) => FIELD_LABELS[f] ?? f).join(", ")}. Nothing was guessed. Fill them in if you want them.
            </p>
          </div>
        </div>
      )}

      {duplicate && (
        <div role="alert" className="rounded-lg border border-primary/40 bg-primary/5 p-4 text-sm">
          <p className="font-medium">You already saved this problem</p>
          <p className="mt-1 text-muted-foreground">
            “{duplicate.title}” uses the same source URL. Nothing was overwritten.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link href={`/problems/${duplicate.id}`}>Open existing problem</Link>
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={isSubmitting} onClick={handleSubmit((v) => submit(v, true))}>
              Save as a separate record
            </Button>
          </div>
        </div>
      )}

      <section className="grid gap-4 rounded-xl border bg-card p-4 sm:p-5">
        <h2 className="font-medium">Basics</h2>
        <Field id="title" label="Title" error={errors.title?.message}>
          <Input
            id="title"
            maxLength={300}
            aria-invalid={!!errors.title}
            {...register("title", { required: "Title is required", validate: (v) => v.trim().length > 0 || "Title is required" })}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="sourceType" label="Source">
            <Controller
              control={control}
              name="sourceType"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="sourceType" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCE_TYPES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {SOURCE_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          {sourceType === "other" ? (
            <Field id="sourceName" label="Source name" error={errors.sourceName?.message}>
              <Input
                id="sourceName"
                maxLength={100}
                placeholder="e.g. CSES, Project Euler"
                aria-invalid={!!errors.sourceName}
                {...register("sourceName", { validate: (v) => v.trim().length > 0 || "Enter a name for the custom source" })}
              />
            </Field>
          ) : (
            <Field id="problemNumber" label="Problem number" optional error={errors.problemNumber?.message}>
              <Input id="problemNumber" maxLength={20} placeholder="e.g. 1" {...register("problemNumber")} />
            </Field>
          )}
        </div>
        <Field id="sourceUrl" label="Source URL" optional error={errors.sourceUrl?.message}>
          <Input id="sourceUrl" type="url" inputMode="url" placeholder="https://…" aria-invalid={!!errors.sourceUrl} {...register("sourceUrl")} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="difficulty" label="Difficulty">
            <Controller
              control={control}
              name="difficulty"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="difficulty" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIFFICULTIES.map((d) => (
                      <SelectItem key={d} value={d}>
                        {DIFFICULTY_LABELS[d]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field id="status" label="Status">
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="status" className="w-full">
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
              )}
            />
          </Field>
          <Field id="priority" label="Priority" error={errors.priority?.message} hint="Your own importance score, 1–10.">
            <Controller
              control={control}
              name="priority"
              render={({ field }) => (
                <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
                  <SelectTrigger id="priority" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unranked</SelectItem>
                    {Array.from({ length: 10 }, (_, i) => String(10 - i)).map((n) => (
                      <SelectItem key={n} value={n}>
                        {n} {Number(n) >= 8 ? "· High" : Number(n) >= 4 ? "· Medium" : "· Low"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        </div>
        <Field id="topics" label="Topics" optional hint="Comma separated, e.g. Arrays, Hash Table, Dynamic Programming">
          <Input id="topics" {...register("topics")} />
        </Field>
      </section>

      <section className="grid gap-4 rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium">Problem statement</h2>
          <span className="text-xs text-muted-foreground">
            {statementFormat === "html" ? "Imported HTML (sanitized when saved)" : "Markdown supported"}
          </span>
        </div>
        {importInfo?.previewHtml && (
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="w-fit">
                Preview imported statement <ChevronDown aria-hidden />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              {/* Server-sanitized HTML from the import preview */}
              <div className="statement mt-3 rounded-lg border bg-muted/20 p-4" dangerouslySetInnerHTML={{ __html: importInfo.previewHtml }} />
            </CollapsibleContent>
          </Collapsible>
        )}
        <Field id="statement" label="Statement" optional error={errors.statement?.message}>
          <Textarea id="statement" rows={8} className={statementFormat === "html" ? "font-mono text-xs" : ""} {...register("statement")} />
        </Field>

        <Collapsible defaultOpen={mode !== "create"}>
          <CollapsibleTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="-ml-2 w-fit">
              Examples, constraints and more <ChevronDown aria-hidden />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 grid gap-5">
            <div className="grid gap-3">
              <div className="flex items-center justify-between">
                <Label>Examples</Label>
                <Button type="button" size="sm" variant="outline" onClick={() => examples.append({ input: "", output: "", explanation: "", images: [] })}>
                  <Plus aria-hidden /> Add example
                </Button>
              </div>
              {examples.fields.length === 0 && <p className="text-sm text-muted-foreground">No examples yet.</p>}
              {examples.fields.map((f, i) => (
                <div key={f.id} className="grid gap-2 rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Example {i + 1}</span>
                    <Button type="button" size="icon" variant="ghost" aria-label={`Remove example ${i + 1}`} onClick={() => examples.remove(i)}>
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Textarea aria-label={`Example ${i + 1} input`} placeholder="Input" rows={2} className="font-mono text-xs" {...register(`examples.${i}.input`)} />
                    <Textarea aria-label={`Example ${i + 1} output`} placeholder="Output" rows={2} className="font-mono text-xs" {...register(`examples.${i}.output`)} />
                  </div>
                  <Textarea aria-label={`Example ${i + 1} explanation`} placeholder="Explanation (optional)" rows={2} {...register(`examples.${i}.explanation`)} />
                  {(f.images ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {f.images!.map((img) => (
                        <div key={img.url} className="relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={img.url} alt={img.alt || `Example ${i + 1} illustration`} className="h-16 w-auto rounded border bg-white" referrerPolicy="no-referrer" />
                          <Button
                            type="button"
                            size="icon"
                            variant="secondary"
                            className="absolute -top-2 -right-2 size-6 rounded-full"
                            aria-label={`Remove image from example ${i + 1}`}
                            onClick={() =>
                              examples.update(i, {
                                ...getValues(`examples.${i}`),
                                images: (f.images ?? []).filter((x) => x.url !== img.url),
                              })
                            }
                          >
                            <Trash2 className="size-3" aria-hidden />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="constraints" label="Constraints" optional hint="One per line.">
                <Textarea id="constraints" rows={4} className="font-mono text-xs" {...register("constraints")} />
              </Field>
              <Field id="followUps" label="Follow-ups" optional hint="One per line.">
                <Textarea id="followUps" rows={4} {...register("followUps")} />
              </Field>
            </div>
            <Field id="similarProblems" label="Similar problems" optional hint="One per line.">
              <Textarea id="similarProblems" rows={3} {...register("similarProblems")} />
            </Field>
            {images.fields.length > 0 && (
              <div className="grid gap-2">
                <Label>Images</Label>
                {images.fields.map((img, i) => (
                  <div key={img.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                    <span className="min-w-0 flex-1 truncate font-mono text-xs">{img.url}</span>
                    <Input aria-label={`Alt text for image ${i + 1}`} placeholder="Alt text" className="h-8 max-w-56" {...register(`images.${i}.alt`)} />
                    <Button type="button" size="icon" variant="ghost" aria-label={`Remove image ${i + 1}`} onClick={() => images.remove(i)}>
                      <ImageOff aria-hidden />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </section>

      <section className="grid gap-4 rounded-xl border bg-card p-4 sm:p-5">
        <h2 className="font-medium">Personal notes</h2>
        <Textarea id="personalNotes" aria-label="Personal notes" rows={4} maxLength={20000} placeholder="Private notes, gotchas, links…" {...register("personalNotes")} />
      </section>

      {mode !== "edit" && (
        <section className="grid gap-4 rounded-xl border bg-card p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <Controller
              control={control}
              name="includeSolution"
              render={({ field }) => (
                <Checkbox id="includeSolution" checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
              )}
            />
            <Label htmlFor="includeSolution" className="font-medium">
              Add a solution now
            </Label>
            <span className="text-xs text-muted-foreground">You can also add solutions later.</span>
          </div>
          {includeSolution && <SolutionFields register={register} control={control} errors={errors.solution} prefix="solution." idPrefix="initial" />}
        </section>
      )}

      {formError && (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
          {mode === "edit" ? "Save changes" : "Save problem"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
