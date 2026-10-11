---
name: tech-decisions
description: Locked stack choices and why (Next 16 proxy.ts, jose, @node-rs/argon2, denormalized problem summary fields, Mongo-backed rate limit)
metadata:
  type: project
---

Versions checked 2026-10-11: next 16.4, react 19.3, tailwind 4.3, mongodb 7.7, zod 4.6, jose 6.2,
@node-rs/argon2 2.2, vitest 5.0, playwright 1.64, mongodb-memory-server 11.3, shiki 4.5, recharts 3.10, sanitize-html 2.18.

Key decisions (details in `.claude/PROJECT_SPEC.md` §0 R1–R18):
- Next 16 uses `src/proxy.ts` (not middleware.ts) — optimistic JWT redirect only.
- Rate limiting stored in Mongo `rateLimits` with TTL (serverless has no shared memory).
- Problems carry denormalized summary fields (solutionCount, languages, hasPreferred, nextRevisionAt, lastRevisedAt, neverRevisedCount) recomputed in the same transaction as version/revision writes — enables server-side filter/sort/paginate.
- Transactions are available (Atlas is a replica set, even M0); tests use MongoMemoryReplSet.
- LeetCode import via public GraphQL endpoint, fallback `__NEXT_DATA__`, else honest manual fallback.
- Imported HTML sanitized at import time with sanitize-html; manual statements are Markdown.
- User `timezone` stored; "due today" computed in user tz; scheduling snaps to start-of-day.
- Scheduling policy: intervals [1,3,7,14,30]; full outcome table in spec §13.
- Built deviations: regex search (no $text index), textarea code editor (no CodeMirror). Chart hue validated: light #4f46e5, dark #7577f0 (--chart-bar).

**Why:** these resolve Vercel serverless + MongoDB constraints in the original prompt.
**How to apply:** don't re-litigate; change only if the user asks or a hard incompatibility appears (then update this file). See [[project-overview]].
