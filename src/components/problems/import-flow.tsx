"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, errorMessage } from "@/lib/api-client";
import { ProblemForm, problemToFormValues, type ProblemFormValues } from "./problem-form";
import type { ParsedProblem } from "@/services/leetcode/parser";

type Preview =
  | { ok: true; slug: string; canonicalUrl: string; data: ParsedProblem; missingFields: string[]; duplicate: { id: string; title: string } | null }
  | { ok: false; reason: string; message: string; slug: string | null; canonicalUrl: string | null; duplicate: { id: string; title: string } | null };

export function ImportFlow() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [formKey, setFormKey] = useState(0);

  async function fetchPreview(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setRequestError(null);
    try {
      const res = await api<Preview>("/api/imports/leetcode/preview", { method: "POST", body: { url } });
      setPreview(res);
      setFormKey((k) => k + 1);
    } catch (err) {
      setRequestError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  let initial: ProblemFormValues | null = null;
  if (preview?.ok) {
    initial = problemToFormValues({
      ...preview.data,
      sourceType: "leetcode",
      sourceUrl: preview.canonicalUrl,
      statementFormat: "html",
    });
  } else if (preview && !preview.ok) {
    // Manual fallback keeps the URL the user entered.
    initial = problemToFormValues({ sourceType: "leetcode", sourceUrl: preview.canonicalUrl ?? url, slug: preview.slug });
  }

  return (
    <div className="grid gap-6">
      <form onSubmit={fetchPreview} className="grid gap-2 rounded-xl border bg-card p-4 sm:p-5">
        <Label htmlFor="import-url">LeetCode problem URL</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="import-url"
            type="url"
            inputMode="url"
            required
            placeholder="https://leetcode.com/problems/two-sum/"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" disabled={loading || !url.trim()}>
            {loading ? <Loader2 className="animate-spin" aria-hidden /> : <Search aria-hidden />}
            Fetch problem
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Reads LeetCode&apos;s publicly available problem data. Premium or blocked problems fall back to manual entry.
        </p>
        {requestError && (
          <p role="alert" className="text-sm text-destructive">
            {requestError}
          </p>
        )}
      </form>

      {preview?.duplicate && (
        <div className="rounded-lg border border-primary/40 bg-primary/5 p-4 text-sm">
          <p className="font-medium">Already in your library</p>
          <p className="mt-1 text-muted-foreground">“{preview.duplicate.title}” has the same URL. Saving again asks for confirmation.</p>
          <Button asChild size="sm" className="mt-3">
            <Link href={`/problems/${preview.duplicate.id}`}>Open existing problem</Link>
          </Button>
        </div>
      )}

      {preview && !preview.ok && (
        <div role="status" className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <div>
            <p className="font-medium">Import didn&apos;t work</p>
            <p className="mt-1 text-muted-foreground">{preview.message} The form below has your URL filled in.</p>
          </div>
        </div>
      )}
      {preview?.ok && (
        <div role="status" className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="size-4" aria-hidden /> Fetched “{preview.data.title}”. Review and edit before saving.
        </div>
      )}

      {initial && (
        <ProblemForm
          key={formKey}
          mode={preview?.ok ? "import" : "create"}
          initial={initial}
          importInfo={preview?.ok ? { missingFields: preview.missingFields, previewHtml: preview.data.statement } : undefined}
        />
      )}
    </div>
  );
}
