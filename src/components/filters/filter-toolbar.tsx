"use client";

import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2, Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  LANGUAGES,
  LANGUAGE_LABELS,
  REVISION_STATUSES,
  REVISION_STATUS_LABELS,
  SORT_LABELS,
  SORT_OPTIONS,
  SOURCE_LABELS,
  SOURCE_TYPES,
  STATUSES,
  STATUS_LABELS,
  type SortOption,
} from "@/lib/constants";
import { activeFilterCount, filtersToSearchParams, type ProblemFilters } from "@/lib/validations/filters";

type ArrayKey = "source" | "difficulty" | "status" | "priorityBand" | "topics" | "language" | "revision";

const BAND_LABELS = { high: "High (8–10)", medium: "Medium (4–7)", low: "Low (1–3)", unranked: "Unranked" } as const;
const SOLUTION_LABELS = { none: "No solutions", any: "At least one solution", multiple: "Multiple solutions" } as const;
const DATE_FIELDS = [
  { from: "createdFrom", to: "createdTo", label: "Date added" },
  { from: "updatedFrom", to: "updatedTo", label: "Last updated" },
  { from: "revisedFrom", to: "revisedTo", label: "Last revised" },
  { from: "nextFrom", to: "nextTo", label: "Next revision" },
] as const;

/** Resets pagination whenever the criteria change; keeps page size. */
function withReset(f: ProblemFilters, patch: Partial<ProblemFilters>): ProblemFilters {
  return { ...f, ...patch, page: 1 };
}

export function FilterToolbar({
  filters,
  facets,
}: {
  filters: ProblemFilters;
  facets: { topics: string[]; sourceNames: string[] };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(filters.q ?? "");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState(filters);
  const lastPushedQ = useRef(filters.q ?? "");
  useLayoutEffect(() => () => setSheetOpen(false), []);

  const navigate = (f: ProblemFilters) => {
    const qs = filtersToSearchParams(f).toString();
    startTransition(() => router.push(qs ? `/problems?${qs}` : "/problems"));
  };

  // Keep the search box in sync with back/forward navigation (derived during render).
  const [syncedQ, setSyncedQ] = useState(filters.q ?? "");
  if ((filters.q ?? "") !== syncedQ) {
    setSyncedQ(filters.q ?? "");
    setQ(filters.q ?? "");
  }

  // Debounced search.
  useEffect(() => {
    if (q.trim() === (filters.q ?? "") || q.trim() === lastPushedQ.current) return;
    const t = setTimeout(() => {
      lastPushedQ.current = q.trim();
      navigate(withReset(filters, { q: q.trim() || undefined }));
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const chips: { key: string; label: string; remove: () => ProblemFilters }[] = [];
  const pushArr = <K extends ArrayKey>(key: K, label: (v: ProblemFilters[K][number]) => string) => {
    for (const v of filters[key] as string[]) {
      chips.push({
        key: `${key}:${v}`,
        label: label(v as ProblemFilters[K][number]),
        remove: () => withReset(filters, { [key]: (filters[key] as string[]).filter((x) => x !== v) } as Partial<ProblemFilters>),
      });
    }
  };
  pushArr("source", (v) => `Source: ${SOURCE_LABELS[v as keyof typeof SOURCE_LABELS]}`);
  pushArr("difficulty", (v) => DIFFICULTY_LABELS[v as keyof typeof DIFFICULTY_LABELS]);
  pushArr("status", (v) => STATUS_LABELS[v as keyof typeof STATUS_LABELS]);
  pushArr("priorityBand", (v) => `Priority: ${BAND_LABELS[v as keyof typeof BAND_LABELS]}`);
  pushArr("topics", (v) => `Topic: ${v}`);
  pushArr("language", (v) => LANGUAGE_LABELS[v as keyof typeof LANGUAGE_LABELS]);
  pushArr("revision", (v) => REVISION_STATUS_LABELS[v as keyof typeof REVISION_STATUS_LABELS]);
  if (filters.sourceName) chips.push({ key: "sourceName", label: `Source name: ${filters.sourceName}`, remove: () => withReset(filters, { sourceName: undefined }) });
  if (filters.priorityMin !== undefined || filters.priorityMax !== undefined)
    chips.push({
      key: "prio",
      label: `Priority ${filters.priorityMin ?? 1}–${filters.priorityMax ?? 10}`,
      remove: () => withReset(filters, { priorityMin: undefined, priorityMax: undefined }),
    });
  if (filters.topics.length > 1) chips.push({ key: "topicMode", label: `Topics: match ${filters.topicMode}`, remove: () => withReset(filters, { topicMode: filters.topicMode === "all" ? "any" : "all" }) });
  if (filters.solutions) chips.push({ key: "solutions", label: SOLUTION_LABELS[filters.solutions], remove: () => withReset(filters, { solutions: undefined }) });
  if (filters.preferred) chips.push({ key: "preferred", label: "Has preferred solution", remove: () => withReset(filters, { preferred: false }) });
  for (const d of DATE_FIELDS) {
    const from = filters[d.from];
    const to = filters[d.to];
    if (from || to)
      chips.push({
        key: d.from,
        label: `${d.label}: ${from ?? "…"} → ${to ?? "…"}`,
        remove: () => withReset(filters, { [d.from]: undefined, [d.to]: undefined } as Partial<ProblemFilters>),
      });
  }
  if (filters.q) chips.push({ key: "q", label: `Search: “${filters.q}”`, remove: () => withReset(filters, { q: undefined }) });

  const count = activeFilterCount(filters);
  const clearAll = (): ProblemFilters => ({
    ...filters,
    q: undefined,
    source: [],
    sourceName: undefined,
    difficulty: [],
    status: [],
    priorityMin: undefined,
    priorityMax: undefined,
    priorityBand: [],
    topics: [],
    topicMode: "any",
    solutions: undefined,
    preferred: false,
    language: [],
    revision: [],
    createdFrom: undefined,
    createdTo: undefined,
    updatedFrom: undefined,
    updatedTo: undefined,
    revisedFrom: undefined,
    revisedTo: undefined,
    nextFrom: undefined,
    nextTo: undefined,
    page: 1,
  });

  return (
    <div className="grid gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            aria-label="Search problems"
            placeholder="Search title, number, source, topic, statement…"
            value={q}
            maxLength={100}
            onChange={(e) => setQ(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex gap-2">
          <Select value={filters.sort} onValueChange={(v) => navigate({ ...filters, sort: v as SortOption, page: 1 })}>
            <SelectTrigger className="w-full sm:w-52" aria-label="Sort by">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {SORT_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => {
              setDraft(filters);
              setSheetOpen(true);
            }}
          >
            <SlidersHorizontal aria-hidden /> Filters
            {count > 0 && <span className="rounded bg-primary px-1.5 text-xs text-primary-foreground tabular-nums">{count}</span>}
          </Button>
        </div>
      </div>

      {(chips.length > 0 || pending) && (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Active filters">
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => navigate(c.remove())}
              className="inline-flex h-7 items-center gap-1 rounded-full border bg-background px-2.5 text-xs hover:bg-muted"
              aria-label={`Remove filter ${c.label}`}
            >
              {c.label}
              <X className="size-3" aria-hidden />
            </button>
          ))}
          {chips.length > 0 && (
            <Button
              variant="link"
              size="sm"
              className="h-7 px-1 text-xs"
              onClick={() => {
                setQ("");
                lastPushedQ.current = "";
                navigate(clearAll());
              }}
            >
              Clear all
            </Button>
          )}
          {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Updating results" />}
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b">
            <SheetTitle>Filters</SheetTitle>
            <SheetDescription>All selected conditions must match. Options inside a group match any.</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 py-2">
            <FilterPanel draft={draft} setDraft={setDraft} facets={facets} />
          </div>
          <SheetFooter className="flex-row gap-2 border-t">
            <Button variant="outline" className="flex-1" onClick={() => setDraft({ ...clearAll(), q: filters.q })}>
              Reset
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                setSheetOpen(false);
                navigate({ ...draft, page: 1 });
              }}
            >
              Show results
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Group({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <Collapsible defaultOpen={defaultOpen} className="border-b py-3 last:border-b-0">
      <CollapsibleTrigger className="group flex w-full items-center justify-between text-sm font-medium">
        {title}
        <ChevronDown className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" aria-hidden />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3 grid gap-2">{children}</CollapsibleContent>
    </Collapsible>
  );
}

function FilterPanel({
  draft,
  setDraft,
  facets,
}: {
  draft: ProblemFilters;
  setDraft: React.Dispatch<React.SetStateAction<ProblemFilters>>;
  facets: { topics: string[]; sourceNames: string[] };
}) {
  const toggle = <K extends ArrayKey>(key: K, value: string, on: boolean) =>
    setDraft((d) => {
      const list = d[key] as string[];
      return { ...d, [key]: on ? [...list, value] : list.filter((x) => x !== value) };
    });

  const checks = <K extends ArrayKey>(key: K, values: readonly string[], label: (v: string) => string, cols = 2) => (
    <div className={cols === 2 ? "grid grid-cols-2 gap-2" : "grid gap-2"}>
      {values.map((v) => {
        const id = `f-${key}-${v}`;
        return (
          <div key={v} className="flex items-center gap-2">
            <Checkbox id={id} checked={(draft[key] as string[]).includes(v)} onCheckedChange={(c) => toggle(key, v, c === true)} />
            <Label htmlFor={id} className="text-sm font-normal">
              {label(v)}
            </Label>
          </div>
        );
      })}
    </div>
  );

  const prioritySelect = (which: "priorityMin" | "priorityMax", label: string) => (
    <Select
      value={draft[which] !== undefined ? String(draft[which]) : "any"}
      onValueChange={(v) => setDraft((d) => ({ ...d, [which]: v === "any" ? undefined : Number(v) }))}
    >
      <SelectTrigger aria-label={label} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="any">{label}: any</SelectItem>
        {Array.from({ length: 10 }, (_, i) => String(i + 1)).map((n) => (
          <SelectItem key={n} value={n}>
            {label}: {n}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const customNames = facets.sourceNames.filter((n) => !Object.values(SOURCE_LABELS).includes(n));

  return (
    <div>
      <Group title="Source">
        {checks("source", SOURCE_TYPES, (v) => SOURCE_LABELS[v as keyof typeof SOURCE_LABELS])}
        {customNames.length > 0 && (
          <Select value={draft.sourceName ?? "any"} onValueChange={(v) => setDraft((d) => ({ ...d, sourceName: v === "any" ? undefined : v }))}>
            <SelectTrigger aria-label="Custom source name" className="mt-1 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any source name</SelectItem>
              {customNames.map((n) => (
                <SelectItem key={n} value={n}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Group>
      <Group title="Difficulty">{checks("difficulty", DIFFICULTIES, (v) => DIFFICULTY_LABELS[v as keyof typeof DIFFICULTY_LABELS])}</Group>
      <Group title="Status">{checks("status", STATUSES, (v) => STATUS_LABELS[v as keyof typeof STATUS_LABELS])}</Group>
      <Group title="Priority">
        {checks("priorityBand", ["high", "medium", "low", "unranked"], (v) => BAND_LABELS[v as keyof typeof BAND_LABELS])}
        <div className="mt-1 grid grid-cols-2 gap-2">
          {prioritySelect("priorityMin", "Min")}
          {prioritySelect("priorityMax", "Max")}
        </div>
        <p className="text-xs text-muted-foreground">A range excludes unranked problems.</p>
      </Group>
      <Group title="Topics" defaultOpen={draft.topics.length > 0}>
        {facets.topics.length === 0 ? (
          <p className="text-sm text-muted-foreground">Add topics to your problems to filter by them.</p>
        ) : (
          <>
            <RadioGroup
              value={draft.topicMode}
              onValueChange={(v) => setDraft((d) => ({ ...d, topicMode: v as "any" | "all" }))}
              className="flex gap-4"
              aria-label="Topic matching"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem id="tm-any" value="any" />
                <Label htmlFor="tm-any" className="font-normal">Match any</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem id="tm-all" value="all" />
                <Label htmlFor="tm-all" className="font-normal">Match all</Label>
              </div>
            </RadioGroup>
            <div className="max-h-48 overflow-y-auto pr-1">{checks("topics", facets.topics, (v) => v, 1)}</div>
          </>
        )}
      </Group>
      <Group title="Solutions">
        <RadioGroup
          value={draft.solutions ?? "all"}
          onValueChange={(v) => setDraft((d) => ({ ...d, solutions: v === "all" ? undefined : (v as ProblemFilters["solutions"]) }))}
          aria-label="Solution availability"
        >
          {(["all", "none", "any", "multiple"] as const).map((v) => (
            <div key={v} className="flex items-center gap-2">
              <RadioGroupItem id={`sol-${v}`} value={v} />
              <Label htmlFor={`sol-${v}`} className="font-normal">
                {v === "all" ? "Any" : SOLUTION_LABELS[v]}
              </Label>
            </div>
          ))}
        </RadioGroup>
        <div className="flex items-center gap-2">
          <Checkbox id="f-preferred" checked={draft.preferred} onCheckedChange={(c) => setDraft((d) => ({ ...d, preferred: c === true }))} />
          <Label htmlFor="f-preferred" className="font-normal">
            Has a preferred solution
          </Label>
        </div>
      </Group>
      <Group title="Language" defaultOpen={draft.language.length > 0}>
        {checks("language", LANGUAGES, (v) => LANGUAGE_LABELS[v as keyof typeof LANGUAGE_LABELS])}
      </Group>
      <Group title="Revision status">
        {checks("revision", REVISION_STATUSES, (v) => REVISION_STATUS_LABELS[v as keyof typeof REVISION_STATUS_LABELS], 1)}
        <p className="text-xs text-muted-foreground">
          A problem takes the status of its most urgent solution, so “Overdue” matches if any version is overdue.
        </p>
      </Group>
      <Group title="Dates" defaultOpen={DATE_FIELDS.some((d) => draft[d.from] || draft[d.to])}>
        {DATE_FIELDS.map((d) => (
          <fieldset key={d.from} className="grid gap-1">
            <legend className="mb-1 text-xs text-muted-foreground">{d.label}</legend>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="date"
                aria-label={`${d.label} from`}
                value={draft[d.from] ?? ""}
                onChange={(e) => setDraft((x) => ({ ...x, [d.from]: e.target.value || undefined }))}
              />
              <Input
                type="date"
                aria-label={`${d.label} to`}
                value={draft[d.to] ?? ""}
                onChange={(e) => setDraft((x) => ({ ...x, [d.to]: e.target.value || undefined }))}
              />
            </div>
          </fieldset>
        ))}
      </Group>
    </div>
  );
}
