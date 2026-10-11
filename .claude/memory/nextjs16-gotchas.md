---
name: nextjs16-gotchas
description: Next 16.4 + cacheComponents rules that broke the build here and how they were fixed
metadata:
  type: project
---

Next 16.4 ships its own docs in node_modules/next/dist/docs/ — read them before changing framework-level code.

- cacheComponents is ON: cookies()/params/searchParams/usePathname must be read inside <Suspense> (pages wrap a content component; sidebar NavLinks wrapped with NavLinksFallback).
- Route handler catch blocks must call `unstable_rethrow(err)` (done in lib/http/handler.ts errorResponse) or prerender bail-outs get swallowed.
- Server pages can't call functions exported from "use client" modules → shared helpers live in non-client files (problem-form-values.ts, activeFilterCount in lib/validations/filters.ts).
- Navigation keeps pages mounted (<Activity>): reset transient UI via useLayoutEffect cleanup; revision workspace keyed by `useRouter().bfcacheId`.
- E2E uses `next dev` because IMPORT_MOCK is ignored in production.

**Why:** each cost a failed build/E2E run. **How to apply:** follow these patterns for any new page/component. See [[tech-decisions]].
