# Daily DSA Progress — Rectified Build Specification

> This is the working spec for the project. It is a rectified version of the original
> "Coding Problem Tracker & Smart Revision SaaS" master prompt. It keeps the original
> scope and adapts it to the chosen hosting (**Vercel**) and database (**MongoDB Atlas**).
> Where this file and the original prompt disagree, this file wins. Section numbers match
> the original prompt so the two can be compared.

- **Product name / title:** Daily DSA Progress
- **Hosting:** Vercel (serverless functions, no long-running processes, no persistent disk)
- **Database:** MongoDB Atlas, using the official `mongodb` driver (no Mongoose)
- **Repository state at start (2026-10-11):** empty directory, not a git repo. Initialize from scratch.

---

## Implementation notes (2026-10-11): where the built app differs from this spec

- **R16:** code is edited in a lightweight monospace textarea (Tab indents; Esc then Tab leaves the field), not CodeMirror. Shiki highlights code when it is displayed.
- **R18:** search is an escaped, case-insensitive regex over the user's own documents (title, sourceName, sourceProblemId, topics, statementText, plus an exact problemNumber match). There is no `$text` index.
- **Next 16 Cache Components is enabled.** Every page reads data inside `<Suspense>`. The API error wrapper calls `unstable_rethrow`. Pages stream, so a not-found page returns HTTP 200 with the not-found UI; the APIs return real 404s.
- **Rate limits:** login allows 20 per IP and 10 per email per 15 minutes; import allows 30 per user per hour.
- **The README is the user-facing source of truth** for the scheduling table, indexes and limitations.

---

## 0. Summary of rectifications

| # | Original requirement | Problem on Vercel + MongoDB | Rectification |
|---|---|---|---|
| R1 | Rate limiting on login/register/import | In-memory counters reset per serverless instance and are not shared | Rate limiting backed by MongoDB: a `rateLimits` collection with a TTL index |
| R2 | Create indexes | Creating indexes on every cold start is slow and racy | `npm run db:init` script creates all indexes, plus a once-per-instance `ensureIndexes()` guard as a safety net |
| R3 | Filter and sort by solution count, language, preferred, revision status, next or last revision | Doing a `$lookup` across `solutionVersions` for every list query breaks index use and makes pagination slow | **Denormalized summary fields** on `problems` (see §6), recomputed inside the same transaction as every write to versions or revisions |
| R4 | Transactions "when supported" | Atlas (including the free M0 tier) runs as a replica set, so transactions **are** supported | Use transactions for preferred-version toggling, cascading deletes, and revision submission. Tests use `MongoMemoryReplSet` |
| R5 | LeetCode HTML scraping with a resilient parser | Problem pages are client-rendered; the HTML has almost no content | Primary path: LeetCode's public GraphQL endpoint (`POST https://leetcode.com/graphql`, `question(titleSlug)`). Fallback: `__NEXT_DATA__` JSON in the page HTML. Last resort: honest failure with manual entry |
| R6 | Fetch timeouts within serverless limits | Hobby-plan function duration is limited; LeetCode or Cloudflare may block or slow Vercel IPs | 8 s outbound timeout, 2 MB response cap, `maxDuration` set on the import route. Treat 403, 429 and challenge pages as "blocked", then fall back to manual entry |
| R7 | Sanitize imported HTML | `isomorphic-dompurify` and `jsdom` are heavy and fragile in serverless bundles | Sanitize **once, at import time, on the server** with `sanitize-html` and a strict allowlist. Store the sanitized HTML. Re-sanitize on write as well, so the database never holds unsafe markup |
| R8 | Manual statement field | Letting users enter raw HTML adds XSS risk | Manual statements are **Markdown**, rendered with `react-markdown` (raw HTML disabled). Imported statements are sanitized HTML. Store a `statementFormat: "markdown" \| "html"` field |
| R9 | "Due today" and timezone handling | Vercel servers run in UTC; "today" depends on the user's timezone | Store `timezone` (IANA) on the user, auto-detected at registration and editable in Settings. "Due today" means `nextRevisionAt` ≤ end of the current day in the user's timezone. All stored dates are UTC `Date` values |
| R10 | Next.js `middleware.ts` | Next.js 16 renamed middleware to `proxy.ts` | Use `src/proxy.ts` for the optimistic auth redirect (JWT check only, no database access). Real authorization still happens in every route handler and service |
| R11 | Argon2id or bcrypt | The native `argon2` package can break on Vercel builds | `@node-rs/argon2` (prebuilt binaries, Argon2id) |
| R12 | JWT library | Must work in both proxy and route handlers | `jose` (HS256), with `iss`, `aud`, `sub` and `exp` claims checked |
| R13 | CSRF protection | Cookie authentication on REST routes | `SameSite=Lax` cookie **plus** an `Origin`/`Host` check on every non-GET API request (shared helper) |
| R14 | Atlas network access | Vercel has no fixed egress IPs on standard plans | Document two options: allow `0.0.0.0/0` with a strong, least-privilege database user, or use the Vercel ↔ MongoDB Atlas integration |
| R15 | Password reset | No email provider in scope | Out of scope for v1. State this clearly in the README. No fake reset link |
| R16 | Code editor | Monaco is about 2 MB and hurts initial bundle size | Server-side syntax highlighting with **Shiki** for viewing. A lazily loaded **CodeMirror 6** (`@uiw/react-codemirror`) for editing, loaded with `next/dynamic` and `ssr:false` |
| R17 | Hint scheduling rule left undefined | Ambiguous | Defined precisely in §13 |
| R18 | Search | `$text` cannot do partial or prefix matches | A `$text` index on title, sourceName, topics and statementText for full-word search. A regex-escaped, anchored prefix search on `titleLower` and `sourceProblemId` for short queries. Atlas Search is a documented future upgrade |

---

## 3. Technology stack (versions checked on 2026-10-11 with `npm view`)

| Area | Choice |
|---|---|
| Framework | Next.js 16.x (App Router), React 19.x, TypeScript strict |
| Styling and UI | Tailwind CSS 4.x, shadcn/ui, lucide-react, `next-themes` (dark mode) |
| Forms and validation | React Hook Form, Zod 4.x (schemas shared between client and server) |
| Database | `mongodb` driver 7.x, MongoDB Atlas |
| Authentication | `jose` 6.x (JWT), `@node-rs/argon2` 2.x, HTTP-only cookie |
| Import | native `fetch` with manual redirect handling, `sanitize-html` 2.x |
| Rendering | `react-markdown` (manual statements), Shiki 4.x (code viewing), CodeMirror 6 (code editing, lazy-loaded) |
| Charts | Recharts 3.x |
| Toasts | `sonner` (shadcn) |
| Tests | Vitest 5.x, `mongodb-memory-server` 11.x (`MongoMemoryReplSet`), Playwright 1.6x |
| Tooling | ESLint (flat config), Prettier, `tsx` for scripts |

Before installing, check peer-dependency compatibility. If a package such as `@uiw/react-codemirror` does not support React 19.x, use the nearest compatible option and note the substitution in the README.

---

## 4. Architecture and folder structure

```text
src/
├── app/
│   ├── (auth)/login, register
│   ├── (app)/dashboard, problems, problems/new, problems/import,
│   │        problems/[id], problems/[id]/edit, problems/[id]/compare,
│   │        revision-queue, revise/[versionId], settings
│   ├── api/
│   │   ├── auth/{register,login,logout,me}/route.ts
│   │   ├── problems/route.ts                    GET list, POST create
│   │   ├── problems/[id]/route.ts               GET, PATCH, DELETE
│   │   ├── problems/[id]/solutions/route.ts     GET list, POST create
│   │   ├── solutions/[id]/route.ts              GET, PATCH, DELETE
│   │   ├── solutions/[id]/preferred/route.ts    POST
│   │   ├── solutions/compare/route.ts           GET ?a=&b=
│   │   ├── imports/leetcode/preview/route.ts    POST
│   │   ├── revisions/route.ts                   GET history, POST session
│   │   ├── revisions/queue/route.ts             GET due/overdue/upcoming
│   │   ├── revisions/stats/route.ts             GET
│   │   └── dashboard/route.ts                   GET metrics, charts, lists
│   ├── layout.tsx, page.tsx (landing → redirect to /dashboard when signed in)
├── proxy.ts                         optimistic auth redirect (Next 16)
├── components/{ui,layout,dashboard,problems,solutions,revisions,filters}
├── lib/
│   ├── env.ts                       Zod-validated server environment (server-only)
│   ├── mongodb/{client.ts,collections.ts,indexes.ts}
│   ├── auth/{jwt.ts,password.ts,session.ts,csrf.ts,rate-limit.ts}
│   ├── http/{responses.ts,errors.ts,handler.ts}   consistent errors and wrapper
│   ├── validations/                 Zod schemas
│   └── utils/{dates.ts,objectid.ts,regex.ts}
├── services/{problems,solutions,revisions,leetcode,dashboard}/
├── repositories/                    typed MongoDB operations, always scoped by userId
├── types/
scripts/db-init.ts                   creates indexes
tests/{unit,integration,e2e}
```

Rules:
- Mark every module under `lib/`, `services/` and `repositories/` with `import "server-only"`.
- Every repository function takes `userId: ObjectId` as its first argument and includes it in every filter. No function anywhere looks up a user-owned document by `_id` alone.
- Route handlers stay thin: authenticate → check CSRF → validate with Zod → call a service → format the response.
- Error format: `{ error: { code: string, message: string, fields?: Record<string,string[]> } }`. Return 404 for documents that are missing or not owned (never 403, which would reveal that the record exists).

---

## 5. Authentication

As in the original prompt, with these specifics:
- Cookie `dsa_session`: HTTP-only, `Secure` in production, `SameSite=Lax`, `Path=/`, 7-day expiry. The JWT `exp` matches the cookie expiry.
- JWT claims: `sub` (user id), `iss` (`APP_URL`), `aud` (`daily-dsa-progress`), `iat`, `exp`, and `tv` (token version). Increment `tokenVersion` on the user to sign out all sessions. The session helper checks `tv` against the database on authenticated API calls.
- Normalize email: trim, lowercase, then validate with Zod.
- Password: 8–128 characters.
- Registration with an email that already exists returns a generic message: "Could not create account. If you already have an account, sign in."
- Login failures always return "Invalid email or password."
- Rate limits (MongoDB-backed, R1): login 10 per 15 minutes per IP and per email; registration 5 per hour per IP; import 20 per hour per user.
- Settings page: change display name, change timezone, change password (requires the current password; increments `tokenVersion`), and delete account (cascades all of the user's data in a transaction).
- Password reset is out of scope (R15).

---

## 6. Database design

All timestamps are UTC `Date` values. All ids are `ObjectId`s.

### users
`_id, name, email (normalized), passwordHash, timezone, tokenVersion, createdAt, updatedAt`
Index: `{ email: 1 }` unique.

### problems
Fields from the original prompt, plus:
- `statementFormat: "markdown" | "html"`
- `statementText`: a plain-text copy of the statement, used for the text index
- `titleLower`: used for prefix search and title sorting
- `canonicalUrl`: normalized, used for duplicate detection
- `importedAt?`, `importMissingFields?: string[]`
- `difficultyRank`: 0 = Unknown, 1 = Easy, 2 = Medium, 3 = Hard (for sorting)
- `statusRank` (for sorting)
- **Denormalized summary fields (R3).** Only server code writes these, inside the transaction that changes versions or revisions:
  - `solutionCount: number`
  - `languages: string[]` (distinct)
  - `hasPreferred: boolean`
  - `nextRevisionAt: Date | null`: the earliest `nextRevisionAt` across versions
  - `lastRevisedAt: Date | null`: the latest across versions
  - `neverRevisedCount: number`: versions with `revisionCount = 0`
- `priorityScore: number | null`. For sorting, store `prioritySort`: the score when set, otherwise `-1` for descending sorts. Use a separate query branch so unranked problems always appear last in both sort directions (see §10).

Enumerations:
- `sourceType`: leetcode, hackerrank, codeforces, geeksforgeeks, interview, book, tutorial, personal, other
- `difficulty`: easy, medium, hard, unknown
- `status`: todo, attempted, solved, needs_revision
- languages: python, javascript, typescript, java, cpp, c, go, rust, other

Indexes:
- `{userId:1, createdAt:-1, _id:-1}`
- `{userId:1, status:1}`
- `{userId:1, priorityScore:-1}`
- `{userId:1, difficulty:1}`
- `{userId:1, sourceType:1}`
- `{userId:1, nextRevisionAt:1}`
- `{userId:1, topics:1}`
- `{userId:1, canonicalUrl:1}` (partial: only where the field exists)
- Text index on `{title, sourceName, topics, statementText}` with weights

### solutionVersions
Fields from the original prompt, plus `stage` (the schedule stage index, see §13).
Indexes:
- `{userId:1, problemId:1}`
- `{userId:1, nextRevisionAt:1}`
- Unique partial index `{userId:1, problemId:1}` where `isPreferred: true`. This lets the database enforce "at most one preferred version", and the transaction also unsets the previous preferred version.

### revisionSessions
Fields from the original prompt, plus:
- `mode: "scheduled" | "manual"`
- `stageBefore`, `stageAfter`
- `wasDue: boolean`

Indexes:
- `{userId:1, revisedAt:-1}`
- `{userId:1, solutionVersionId:1, revisedAt:-1}`

### rateLimits (R1)
`{ key, count, expiresAt }`. Indexes: `{ key: 1 }` unique, and `{ expiresAt: 1 }` with `expireAfterSeconds: 0`.

### Cascades (always in a transaction)
- Deleting a problem deletes its versions and its revision sessions.
- Deleting a version deletes its revision sessions and recomputes the problem's summary fields.
- Deleting the account deletes everything the user owns.

---

## 7. Adding problems

### Workflow A: LeetCode import (R5, R6, R7)
1. Validate the URL. Allowed hosts: `leetcode.com` and `www.leetcode.com` only. The path must match `/problems/<slug>/...`. Extract the slug, and build `canonicalUrl = https://leetcode.com/problems/<slug>/`.
2. Check for duplicates by `canonicalUrl` for this user. If one exists, return it so the UI can offer "Open existing" or "Save as a separate record".
3. Fetch:
   - Send a GraphQL POST to `https://leetcode.com/graphql` with fields `questionFrontendId, title, titleSlug, difficulty, content, topicTags{name}, similarQuestions, exampleTestcases`.
   - Send no cookies and no authorization headers. Set `redirect: "manual"` and check each redirect target against the host allowlist (maximum 3 redirects).
   - Resolve DNS and reject private, loopback, link-local and reserved addresses before connecting.
   - Use an 8 s timeout and stream the body, aborting above 2 MB.
4. If GraphQL fails, try the page HTML's `__NEXT_DATA__` JSON. Do not use CSS-selector scraping as the primary method.
5. Parse the `content` HTML into:
   - the statement (sanitized HTML)
   - examples (from `<pre>` blocks with Input, Output and Explanation)
   - constraints (the list after "Constraints:")
   - follow-ups (paragraphs starting "Follow-up" or "Follow up")
   - images (`src` and `alt`; only allow images from `assets.leetcode.com` and `leetcode.com`)
6. Return an editable preview with `missingFields[]`. Do not fill in missing values.
7. If LeetCode blocks the request (403 or 429, a Cloudflare challenge, or a timeout), return `{ ok:false, reason, slug, canonicalUrl }`. The UI keeps everything the user entered and switches to the manual form with the URL and source already filled in.
8. Saving goes through the same `createProblem` service as manual entry, with an optional initial solution and priority.
9. Put this in the README: the GraphQL endpoint is public but undocumented and may change or block cloud IPs. The importer does not bypass logins, premium content, CAPTCHAs or bot protection. Premium problems return "content unavailable".

### Workflow B: Manual entry
As in the original prompt. The statement is Markdown (R8). Only the title is required. The default source is "personal".

---

## 8–12. Priority, library, filters, detail page, solution versions

Same as the original prompt, with these implementation rules:

- **Filters are built by one pure function** `buildProblemQuery(userId, filters)` that returns `{ filter, sort }`. It is unit-tested and reads only Zod-parsed values, so no raw client objects reach MongoDB.
- **Version-derived filters use the summary fields (R3):**
  - No solutions: `solutionCount: 0`
  - Has solutions: `solutionCount ≥ 1`
  - Multiple solutions: `solutionCount ≥ 2`
  - Has a preferred version: `hasPreferred: true`
  - Language filter: `languages: {$in: [...]}`
  - Revision status:
    - **Overdue:** `nextRevisionAt` < start of today (user's timezone)
    - **Due today:** `nextRevisionAt` within today
    - **Upcoming:** `nextRevisionAt` > end of today
    - **Not scheduled:** `nextRevisionAt` is null
    - **Never revised:** `neverRevisedCount > 0`
  - Because `nextRevisionAt` is the earliest date across versions, "overdue" matches a problem when **at least one** of its versions is overdue. Document this rule in the UI tooltip and the README.
- **Priority sort:** unranked problems come last in both directions. Implement with `$addFields: {ranked: priorityScore != null}` in an aggregation and sort by `{ranked:-1, priorityScore:±1, createdAt:-1, _id:-1}`. Every sort ends with `createdAt, _id` as tie-breakers so pagination is stable.
- **Pagination:** offset-based (`page` and `pageSize`, at most 50) using `$facet`, which returns the items and the total count together.
- **URL state:** filters and sort are stored in `searchParams`. The library page is a server component that reads them. Filter controls update the URL with `router.replace`/`push`, and changing a filter resets to page 1.
- **Topics:** a "match any / match all" toggle maps to `$in` / `$all`.
- **Comparison:** `/problems/[id]/compare?a=&b=`, both versions loaded with an ownership check. On desktop, show them side by side; on mobile, stack them. Shiki highlights the code.

---

## 13. Revision scheduling (R17: the full policy)

Intervals by stage: `[1, 3, 7, 14, 30]` days. `stage` counts from 0. A new version gets `stage = 0` and `nextRevisionAt = now + 1 day`.

| Outcome | Stage change | Next interval |
|---|---|---|
| `solved_independently`, confidence ≥ 3 | `stage = min(stage+1, 4)` | `INTERVALS[stage]` |
| `solved_independently`, confidence ≤ 2 | stage unchanged | `INTERVALS[stage]` |
| `solved_with_hints` | stage unchanged | `max(1, floor(INTERVALS[stage] / 2))` |
| `viewed_solution` | reset to `stage = 0` by default | 1 day |
| `unable_to_solve` | reset to `stage = 0` by default | 1 day |

- For `viewed_solution` and `unable_to_solve`, the form shows a **"Restart schedule"** checkbox, checked by default. Unchecking it keeps the current stage and uses the hint rule instead.
- Note on the first revision: a successful first revision moves the version from stage 0 to stage 1, which gives the original prompt's 3-day interval. The 2nd, 3rd and 4th successful revisions give 7, 14 and 30 days, and later ones stay at 30.
- `nextRevisionAt = startOfDayInUserTz(now) + intervalDays`. Snapping to the start of the day means a card scheduled at 23:00 is still due on the following calendar day.
- A manual revision (one not yet due) uses the same policy and records `mode: "manual"` and `wasDue: false`.
- Only `POST /api/revisions` changes the schedule. Opening a problem or revealing a solution does not count as a revision.
- One pure function, `computeNextSchedule({stage, outcome, confidence, restart, now, timezone})`, implements the whole policy and has full unit tests, including timezone boundary and daylight-saving cases.
- A submission is one transaction: insert the session, update the version (`revisionCount+1`, `lastRevisedAt`, `stage`, `nextRevisionAt`), and recompute the problem's summary fields.
- The queue is calculated on request. There are no cron jobs.

---

## 14. Dashboard

As in the original prompt. Build it with a single aggregation route (`$facet`) scoped by `userId`. Metric definitions, which the dashboard shows in a tooltip or legend:
- **Solved problems:** problems with `status = solved`. This is the user's own label, not their revision results.
- **Unsolved problems:** status is todo or attempted.
- **Needing revision:** status is `needs_revision`, **or** the problem has an overdue version. Show both numbers separately.
- **High priority:** `priorityScore ≥ 8`.
- **Revision activity:** sessions per day for the last 30 days, grouped by day in the user's timezone.
- Every chart has a text alternative: a data table that the user can expand or a screen reader can read.

---

## 15. UI

As in the original prompt. Brand: "Daily DSA Progress". Desktop has a sidebar (Dashboard, Problems, Revision Queue, Settings); mobile has a top bar with a sheet menu. Dark mode uses `next-themes`. Priority appears as a badge with the number plus a Low/Med/High label, and an `aria-label` such as "Priority 8 of 10, high".

---

## 18. Security checklist (beyond the original prompt)

- `lib/env.ts` validates the environment with Zod. The app fails fast if `JWT_SECRET` is shorter than 32 bytes.
- Validate `ObjectId`s with a Zod refinement before any query. An invalid id returns 404.
- Search strings are length-capped (100 characters) and regex-escaped before use.
- Responses set security headers through `next.config` headers(): CSP (images allowed from `self` plus `assets.leetcode.com`), `X-Content-Type-Options`, `Referrer-Policy`, `frame-ancestors 'none'`.
- Production logs never include request bodies, passwords, tokens, or the full Mongo URI.

---

## 19. AI

None in v1. Do not add AI buttons or placeholders.

---

## 20. Testing

As in the original prompt, plus:
- Integration tests run against `MongoMemoryReplSet`, so transactions are actually exercised.
- LeetCode network calls are mocked: GraphQL success, partial data, 403 or a Cloudflare challenge, a timeout, an oversized response, and a redirect to a disallowed host.
- Playwright E2E runs against `next build && next start` with an in-memory replica set and a mocked importer, enabled by `IMPORT_MOCK=1`. That flag is honored only when `NODE_ENV !== "production"`.

---

## 21. Environment

```text
MONGODB_URI=            # Atlas SRV string
MONGODB_DB_NAME=daily_dsa_progress
JWT_SECRET=             # openssl rand -base64 48
APP_URL=                # http://localhost:3000 locally, https://<project>.vercel.app in prod
```

No other variables are required. `IMPORT_MOCK` is used by tests only.

---

## 22. Deployment (Vercel + Atlas)

- Atlas: create the cluster (M0 is enough), a database user with `readWrite` on `daily_dsa_progress` only, and network access (R14).
- Run `npm run db:init` once against the production URI, from a local machine, to create the indexes.
- Vercel: import the repository, set the four environment variables for the Production and Preview environments, and keep the build command `next build`. Set `export const maxDuration = 15` on the import route.
- The MongoDB client is cached on `globalThis`, which reuses connections in development and across warm serverless invocations. Use `maxPoolSize: 10`.
- Do not claim a deployment succeeded unless it was actually verified.

---

## 23. Phases

Same nine phases as the original prompt. At the end of each phase, update `.claude/memory/project-progress.md` with what was done, the check results, and open issues.

## 24–25. Acceptance criteria and final report

Unchanged from the original prompt.
