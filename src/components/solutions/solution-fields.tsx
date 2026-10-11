"use client";

import type { Control, FieldErrors, FieldValues, Path, UseFormRegister } from "react-hook-form";
import { Controller } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/common/field";
import { LANGUAGES, LANGUAGE_LABELS, type Language } from "@/lib/constants";
import { CodeTextarea } from "./code-textarea";

export interface SolutionValues {
  programmingLanguage: Language;
  label: string;
  code: string;
  approach: string;
  timeComplexity: string;
  spaceComplexity: string;
  personalNotes: string;
}

/** Shared solution inputs. `prefix` is the RHF path ("" or "solution."). */
export function SolutionFields<T extends FieldValues>({
  register,
  control,
  errors,
  prefix = "",
  idPrefix = "sol",
}: {
  register: UseFormRegister<T>;
  control: Control<T>;
  errors?: FieldErrors<SolutionValues>;
  prefix?: "" | "solution.";
  idPrefix?: string;
}) {
  const id = (k: string) => `${idPrefix}-${k}`;
  const name = (k: keyof SolutionValues) => `${prefix}${k}` as Path<T>;
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={id("language")} label="Language" error={errors?.programmingLanguage?.message}>
          <Controller
            control={control}
            name={name("programmingLanguage")}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id={id("language")} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l} value={l}>
                      {LANGUAGE_LABELS[l]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
        <Field id={id("label")} label="Version label" optional error={errors?.label?.message} hint="Defaults to “Language — approach”.">
          <Input id={id("label")} maxLength={100} placeholder="e.g. Hash map, one pass" {...register(name("label"))} />
        </Field>
      </div>
      <Field id={id("code")} label="Code" error={errors?.code?.message} hint="Tab inserts spaces. Press Esc, then Tab, to leave the editor.">
        <CodeTextarea id={id("code")} aria-invalid={!!errors?.code} {...register(name("code"))} />
      </Field>
      <Field id={id("approach")} label="Approach" optional error={errors?.approach?.message}>
        <Textarea id={id("approach")} rows={3} maxLength={5000} placeholder="Key idea, invariants, edge cases" {...register(name("approach"))} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={id("time")} label="Time complexity" optional error={errors?.timeComplexity?.message}>
          <Input id={id("time")} className="font-mono" maxLength={100} placeholder="O(n)" {...register(name("timeComplexity"))} />
        </Field>
        <Field id={id("space")} label="Space complexity" optional error={errors?.spaceComplexity?.message}>
          <Input id={id("space")} className="font-mono" maxLength={100} placeholder="O(n)" {...register(name("spaceComplexity"))} />
        </Field>
      </div>
      <Field id={id("notes")} label="Notes" optional error={errors?.personalNotes?.message}>
        <Textarea id={id("notes")} rows={3} maxLength={20000} {...register(name("personalNotes"))} />
      </Field>
    </div>
  );
}
