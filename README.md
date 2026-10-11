# Daily DSA Progress

A private, multi-user workspace for coding interview prep. Save problems from LeetCode or any other source, keep several solutions per problem, give each problem a personal 1–10 priority, and revise solutions on a spaced-repetition schedule.

## Features

- **Two ways to add problems.**
  - Import a public LeetCode problem from its URL. You get an editable preview, a list of fields that were not found, duplicate detection, and a manual fallback if the import fails.
  - Create a problem by hand from any source. Only the title is required.

  Both use the same `problems` record.
- **Multiple solution versions per problem**, in different languages or with different approaches. You can mark one as preferred, compare two side by side, and see syntax-highlighted code.
- **Three separate measures per problem:**
  - **Difficulty** (Easy, Medium, Hard, Unknown)
  - **Priority**: your own optional 1–10 score
  - **Revision performance**: the outcome and confidence of each revision

  None of these is derived from another.
- **Spaced-repetition revision for each solution version.** The schedule runs 1, 3, 7, 14 and 30 days. There is a revision queue (overdue, due today, upcoming) and a revision page that hides the solution until you reveal it. Every attempt is kept in the history.
- **Problem library** with server-side search, combinable filters, sorting, pagination, and filter state stored in the URL.
  - Filters: source, custom source name, difficulty, status, priority (exact, range, or Low/Medium/High/Unranked bands), topics (match any or all), solution availability, preferred solution, language, revision status, and four date ranges.
- **Dashboard** built from your real data: metrics, charts (each with a table view), recent activity, and high-priority items.
- **Accounts:** register, log in, log out, change name and timezone, change password (this signs out your other sessions), and delete your account. Light and dark themes.

There are no AI features in this version, and no AI SDK or key is needed.

## Technology stack

| Area | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Cache Components, `proxy.ts`), React 19, TypeScript strict |
| UI | Tailwind CSS 4, shadcn/ui (Radix), lucide-react, Recharts, Shiki (server-side highlighting), sonner |
| Forms and validation | React Hook Form, Zod 4 (on the server for every input) |
| Database | MongoDB Atlas with the official `mongodb` driver (no Mongoose) |
| Auth | JWT (`jose`, HS256) in an HTTP-only cookie, Argon2id passwords (`@node-rs/argon2`) |
| Import | Built-in HTTPS client with SSRF protection, `sanitize-html`, `htmlparser2` |
| Tests | Vitest and `mongodb-memory-server` (a real replica set, so transactions are tested), Playwright |

## Project structure

```text
src/
├── app/
│   ├── (auth)/login, register
│   ├── (app)/dashboard, problems, problems/new, problems/import, problems/[id],
│   │        problems/[id]/edit, problems/[id]/compare, problems/[id]/solutions/…,
│   │        revision-queue, revise/[versionId], settings
│   └── api/   auth/*, problems/*, solutions/*, imports/leetcode/preview, revisions/*, dashboard
├── proxy.ts            optimistic auth redirects (no DB access)
├── components/         ui (shadcn), layout, common, problems, solutions, revisions, filters, dashboard, settings
├── lib/                env, mongodb, auth, http (errors and route wrappers), validations, sanitize, utils
├── services/           problems, solutions, revisions (incl. schedule.ts), leetcode, dashboard, users
├── repositories/       typed MongoDB access; every function is scoped by userId
└── types/              domain documents and API DTOs
scripts/                db-init.ts (indexes), memory-db.ts (local in-memory replica set)
tests/                  unit/, integration/, e2e/
```

## Prerequisites

- Node.js 20.9 or newer (developed on Node 22)
- A MongoDB Atlas cluster. The free M0 tier works and supports transactions.
- A Vercel account for deployment

## Local installation

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run db:init              # creates collections and indexes
npm run dev                  # http://localhost:3000
```

### Running without Atlas

To try the app without Atlas, start a throwaway in-memory replica set in a second terminal:

```bash
npx tsx scripts/memory-db.ts 27999
# then in .env.local:
# MONGODB_URI=mongodb://127.0.0.1:27999/?replicaSet=rs0
```

The data disappears when the process stops.

## Environment configuration

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | yes | Atlas SRV connection string |
| `MONGODB_DB_NAME` | no (default `daily_dsa_progress`) | Database name |
| `JWT_SECRET` | yes | At least 32 characters. Generate one with `openssl rand -base64 48` |
| `APP_URL` | yes in production | Public base URL with no trailing slash, e.g. `https://your-app.vercel.app`. Used for JWT issuer checks and CSRF origin checks |

The app checks the environment with Zod on first use and stops with a clear message if anything is missing or invalid. Use different values (especially `JWT_SECRET` and the database) for local development and production. Never commit `.env*` files; `.gitignore` already excludes them except `.env.example`.

`IMPORT_MOCK=1` is used only by tests. It is ignored when `NODE_ENV=production`.

## MongoDB Atlas setup

1. Create a cluster (M0 is fine) and a database user that has only `readWrite` access to your database (e.g. `daily_dsa_progress`).
2. **Network access.** Vercel functions don't have fixed outbound IPs on standard plans. Choose one:
   - Allow `0.0.0.0/0` and rely on a strong, least-privilege database user and password, or
   - Use the official **MongoDB Atlas integration on the Vercel Marketplace**, or Vercel's static IPs on plans that offer them.
3. Copy the SRV connection string (`mongodb+srv://…`) into `MONGODB_URI`.
4. Run `npm run db:init` once per database, from your machine with production values in `.env.local` or the shell. The app also creates any missing indexes on its first request, as a safety net.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit and integration tests (starts an in-memory MongoDB replica set; the first run downloads a `mongod` binary) |
| `npm run test:e2e` | Playwright end-to-end tests. Starts an in-memory DB and `next dev` on port 3100 with the LeetCode importer mocked. Run `npx playwright install chromium` once first |
| `npm run db:init` | Create collections and indexes |

## Deploying to Vercel

1. Push the repository to GitHub, GitLab or Bitbucket and import it in Vercel. The framework is detected as Next.js; keep the default build command (`next build`) and output settings.
2. In **Project → Settings → Environment Variables**, add `MONGODB_URI`, `MONGODB_DB_NAME`, `JWT_SECRET` and `APP_URL` for Production. Add them for Preview too, ideally pointing at a separate database. `APP_URL` must be the production domain. Preview deployments are allowed through the CSRF check because their requests match their own `Host`.
3. Run `npm run db:init` against the production database.
4. Deploy, then register an account and add a problem to check that everything works.

Serverless notes:
- The MongoDB client is cached on `globalThis` and reused across warm invocations (`maxPoolSize: 10`).
- Nothing is written to the filesystem.
- Rate-limit counters are stored in MongoDB with a TTL index, so they work across instances.
- The import route sets `maxDuration = 20`. Each outbound request is limited to 8 s and 2 MB.
- The due-revision queue is calculated on each request. There are no cron jobs or background workers.

## Security

- **Isolation between users.**
  - Every repository function takes the user's ID first, and every query includes it.
  - Aggregations refuse to run unless the pipeline starts with a `$match` on that user ID.
  - Records that are missing or belong to someone else both return **404**, so the response doesn't reveal whether a record exists.
- **Authentication.**
  - Passwords are hashed with Argon2id (19 MiB memory, t=2).
  - The JWT is checked for signature (HS256 only), expiry, issuer, audience and subject. It also carries a token version, which is compared with the database on every request. Changing your password or deleting your account invalidates existing tokens.
  - The cookie is `HttpOnly`, `SameSite=Lax`, and `Secure` in production. Tokens are never put in `localStorage`.
- **Account enumeration.**
  - Login always returns "Invalid email or password" and runs a password check even when the email doesn't exist, so timing doesn't reveal it either.
  - Registering an existing email returns a generic message.
- **CSRF.** Requests that change data must come from your own site's origin, checked with `Origin` or `Sec-Fetch-Site`. This is in addition to `SameSite=Lax`.
- **Rate limits.**
  - Login: 20 per 15 minutes per IP, and 10 per 15 minutes per email
  - Registration: 5 per hour per IP
  - Import: 30 per hour per user
  - Password change and account deletion: 10 and 5 per 15 minutes
- **Input handling.**
  - Every body, query and path parameter is validated with Zod.
  - Filters accept only string values from a fixed list, so client-supplied MongoDB operators can't get through.
  - Sort keys are restricted to a fixed list.
  - Search text is regex-escaped and limited to 100 characters.
  - Unknown fields on updates, such as `userId` or `solutionCount`, are rejected.
  - Revision counts, stages and dates are always computed on the server.
- **Imported HTML.**
  - Sanitized with a strict allowlist when the problem is saved, and again when it is displayed.
  - Images are allowed only from `assets.leetcode.com` and `leetcode.com`, over https.
  - Markdown statements are rendered without raw HTML.
- **SSRF protection on import.**
  - Only https to `leetcode.com` and `www.leetcode.com`. IP addresses and other ports are rejected, and every redirect is checked (at most 3).
  - DNS answers are checked when the connection is made, which blocks DNS rebinding to private, loopback, link-local, CGNAT or reserved addresses.
  - No cookies or credentials are sent. Timeout and size limits apply.
- **Response headers:** CSP, `X-Frame-Options: DENY`, `nosniff`, a strict referrer policy and a permissions policy. Errors never include stack traces, and logs never include request bodies.

## Revision scheduling

All of the logic is in `src/services/revisions/schedule.ts` and is unit-tested.

| Outcome | Stage | Next interval |
|---|---|---|
| New solution version | 0 | 1 day |
| Solved independently, confidence ≥ 3 | +1 (max 4) | 3 → 7 → 14 → 30 → 30 days |
| Solved independently, confidence ≤ 2 | unchanged | current stage's interval |
| Solved with hints | unchanged | half the current interval (min 1 day) |
| Viewed solution / unable to solve | reset to 0 (default) | 1 day |
| …with "restart schedule" unticked | unchanged | half the current interval |

**Timezone.** Each user has an IANA timezone, detected when they register and editable in Settings. Due dates are set to local midnight in that timezone, so "due in 3 days" means "from the start of the calendar day 3 days from now". Dates are stored in UTC.

**Queue buckets:**
- **Overdue:** due before the start of today
- **Due today:** due before the start of tomorrow
- **Upcoming:** later than that

Revising before the due date (a "manual" revision) follows the same rules and is labelled as manual in the history.

**Status of a problem with several versions.** A problem takes the revision status of its most urgent version, the one with the earliest `nextRevisionAt`. So the **Overdue** filter matches a problem if *any* of its versions is overdue.

## Database

| Collection | Notes |
|---|---|
| `users` | `email` stored lowercased and trimmed, with a unique index |
| `problems` | One model for imported and manual problems. Also stores summary fields copied from its solution versions (`solutionCount`, `languages`, `hasPreferred`, `nextRevisionAt`, `lastRevisedAt`, `neverRevisedCount`). These are recalculated in the same transaction as every change to versions or revisions, which lets filtering, sorting and pagination run entirely on the server |
| `solutionVersions` | Belongs to one problem and one user. Each has its own `stage`, `revisionCount` and schedule |
| `revisionSessions` | Full history of every revision: outcome, confidence, hints, whether the solution was viewed, notes, mode, and stage and date before and after |
| `rateLimits` | Fixed-window counters, removed automatically by a TTL index |

**Indexes:**
- `users`: `{email}` (unique)
- `problems`:
  - `{userId, createdAt, _id}`, `{userId, status}`, `{userId, priorityScore}`, `{userId, difficulty}`, `{userId, sourceType}`, `{userId, nextRevisionAt}`, `{userId, topics}`
  - `{userId, canonicalUrl}` (partial)
- `solutionVersions`:
  - `{userId, problemId}`, `{userId, nextRevisionAt}`
  - **unique partial** `{userId, problemId, isPreferred}` where `isPreferred: true`
- `revisionSessions`: `{userId, revisedAt}`, `{userId, solutionVersionId, revisedAt}`, `{userId, problemId}`
- `rateLimits`: TTL on `expiresAt`

**Integrity:**
- These operations run in transactions:
  - Marking a version as preferred. The unique partial index also guarantees at most one preferred version per problem, even with concurrent requests.
  - Deleting a problem (its versions and revisions go with it).
  - Deleting a version (its revisions go with it).
  - Submitting a revision. This also uses a guard on `revisionCount`, so two concurrent submissions can't both be applied.
  - Deleting an account.
- **Duplicates.** Import and manual creation both check the normalized source URL for the same user. If it matches, you can open the existing problem or deliberately save a separate one. Nothing is ever overwritten.

## Known limitations and troubleshooting

- **The LeetCode importer** uses LeetCode's public GraphQL endpoint, falling back to the `__NEXT_DATA__` data embedded in the problem page.
  - This endpoint is undocumented and may change, slow down, or block Vercel's IP addresses.
  - Premium problems, blocked requests and timeouts produce a clear message and switch to the manual form with your URL filled in.
  - The importer never logs in or works around CAPTCHAs or bot protection. Check that your use follows LeetCode's terms.
- **Search** uses escaped, case-insensitive regex over one user's own problems (title, source, IDs and numbers, topics, statement text). It matches substrings, not word stems, and there's no relevance ranking. Atlas Search would be the upgrade path for large libraries.
- **Code editing** uses a lightweight monospace text box: Tab indents, and Esc then Tab moves focus out. Code is highlighted when displayed, not while editing.
- **Password reset by email** is not included because no email provider is configured. Signed-in users can change their password in Settings.
- **Pages for records you can't access** show the "Not found" screen, but the HTTP status is 200. Pages stream, so the status is sent before the ownership check runs. API routes return a proper 404, and no data is sent either way.
- **Changing your timezone** changes which day counts as "today". Due dates already stored are not recalculated.
- **Troubleshooting:**
  - `Invalid environment configuration` → check `.env.local` or the Vercel environment variables.
  - `MongoServerSelectionError` on Vercel → check Atlas network access.
  - The first `npm test` is slow while it downloads the `mongod` binary.
