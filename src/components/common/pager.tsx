import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Server-rendered pagination; `href(page)` preserves the current filters. */
export function Pager({ page, totalPages, href }: { page: number; totalPages: number; href: (page: number) => string }) {
  if (totalPages <= 1) return null;
  const pages = new Set([1, totalPages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= totalPages));
  const sorted = [...pages].sort((a, b) => a - b);
  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-1">
      <Button asChild={page > 1} variant="ghost" size="sm" disabled={page <= 1}>
        {page > 1 ? (
          <Link href={href(page - 1)} aria-label="Previous page"><ChevronLeft aria-hidden /> Prev</Link>
        ) : (
          <span><ChevronLeft aria-hidden /> Prev</span>
        )}
      </Button>
      {sorted.map((p, i) => (
        <span key={p} className="flex items-center">
          {i > 0 && sorted[i - 1] !== p - 1 && <span className="px-1 text-muted-foreground">…</span>}
          <Button asChild variant={p === page ? "default" : "ghost"} size="sm" className="tabular-nums">
            <Link href={href(p)} aria-current={p === page ? "page" : undefined}>{p}</Link>
          </Button>
        </span>
      ))}
      <Button asChild={page < totalPages} variant="ghost" size="sm" disabled={page >= totalPages}>
        {page < totalPages ? (
          <Link href={href(page + 1)} aria-label="Next page">Next <ChevronRight aria-hidden /></Link>
        ) : (
          <span>Next <ChevronRight aria-hidden /></span>
        )}
      </Button>
    </nav>
  );
}
