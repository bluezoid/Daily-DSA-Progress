import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Import, Library, Plus, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { ListSkeleton } from "@/components/common/skeletons";
import { Pager } from "@/components/common/pager";
import { FilterToolbar } from "@/components/filters/filter-toolbar";
import { ProblemList } from "@/components/problems/problem-list";
import { requireUser } from "@/lib/auth/require-user";
import { activeFilterCount, filtersToSearchParams, parseProblemFilters } from "@/lib/validations/filters";
import { toProblemListItem } from "@/lib/mappers";
import { getFilterFacets, listProblems } from "@/services/problems/problem.service";

export const metadata: Metadata = { title: "Problems" };

type SP = Promise<Record<string, string | string[] | undefined>>;

async function Library_({ searchParams }: { searchParams: SP }) {
  const user = await requireUser();
  const filters = parseProblemFilters(await searchParams);
  const [result, facets] = await Promise.all([listProblems(user, filters), getFilterFacets(user)]);
  const items = result.items.map(toProblemListItem);
  const filtered = activeFilterCount(filters) > 0 || Boolean(filters.q);

  return (
    <div className="grid gap-4">
      <FilterToolbar filters={filters} facets={facets} />
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {result.total === 0 ? "No problems" : `${result.total} problem${result.total === 1 ? "" : "s"}`}
        {filtered ? " match your filters" : ""}
        {result.total > 0 && result.totalPages > 1 ? ` · page ${result.page} of ${result.totalPages}` : ""}
      </p>
      {items.length > 0 ? (
        <>
          <ProblemList items={items} timezone={user.timezone} />
          <Pager
            page={result.page}
            totalPages={result.totalPages}
            href={(page) => {
              const qs = filtersToSearchParams({ ...filters, page }).toString();
              return qs ? `/problems?${qs}` : "/problems";
            }}
          />
        </>
      ) : filtered || result.total > 0 ? (
        <EmptyState
          icon={SearchX}
          title={result.total > 0 ? "This page is empty" : "No problems match"}
          description="Try removing a filter or changing your search."
          action={
            <Button asChild variant="outline">
              <Link href="/problems">Clear all filters</Link>
            </Button>
          }
        />
      ) : (
        <EmptyState
          icon={Library}
          title="Your library is empty"
          description="Import a LeetCode problem or add one from any source to get started."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild>
                <Link href="/problems/new"><Plus aria-hidden /> New problem</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/problems/import"><Import aria-hidden /> Import from LeetCode</Link>
              </Button>
            </div>
          }
        />
      )}
    </div>
  );
}

export default function ProblemsPage(props: { searchParams: SP }) {
  return (
    <>
      <PageHeader
        title="Problems"
        description="Everything you have saved, with search, filters and sorting."
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/problems/import"><Import aria-hidden /> Import</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/problems/new"><Plus aria-hidden /> New problem</Link>
            </Button>
          </>
        }
      />
      <Suspense fallback={<ListSkeleton />}>
        <Library_ searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
