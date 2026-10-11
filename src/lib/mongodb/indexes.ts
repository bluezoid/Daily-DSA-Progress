import type { Db } from "mongodb";

/** Creates every index the app relies on. Idempotent. */
export async function ensureIndexes(db: Db): Promise<void> {
  // Collections must exist before use inside multi-document transactions.
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
  for (const name of ["users", "problems", "solutionVersions", "revisionSessions", "rateLimits"]) {
    if (!existing.has(name)) {
      try {
        await db.createCollection(name);
      } catch (err) {
        // Another instance may have created it concurrently (NamespaceExists = 48).
        if ((err as { code?: number }).code !== 48) throw err;
      }
    }
  }

  await Promise.all([
    db.collection("users").createIndexes([{ key: { email: 1 }, name: "email_unique", unique: true }]),

    db.collection("problems").createIndexes([
      { key: { userId: 1, createdAt: -1, _id: -1 }, name: "user_created" },
      { key: { userId: 1, status: 1 }, name: "user_status" },
      { key: { userId: 1, priorityScore: -1 }, name: "user_priority" },
      { key: { userId: 1, difficulty: 1 }, name: "user_difficulty" },
      { key: { userId: 1, sourceType: 1 }, name: "user_source" },
      { key: { userId: 1, nextRevisionAt: 1 }, name: "user_next_revision" },
      { key: { userId: 1, topics: 1 }, name: "user_topics" },
      {
        key: { userId: 1, canonicalUrl: 1 },
        name: "user_canonical_url",
        partialFilterExpression: { canonicalUrl: { $type: "string" } },
      },
    ]),

    db.collection("solutionVersions").createIndexes([
      { key: { userId: 1, problemId: 1 }, name: "user_problem" },
      { key: { userId: 1, nextRevisionAt: 1 }, name: "user_next_revision" },
      {
        key: { userId: 1, problemId: 1, isPreferred: 1 },
        name: "one_preferred_per_problem",
        unique: true,
        partialFilterExpression: { isPreferred: true },
      },
    ]),

    db.collection("revisionSessions").createIndexes([
      { key: { userId: 1, revisedAt: -1 }, name: "user_revised" },
      { key: { userId: 1, solutionVersionId: 1, revisedAt: -1 }, name: "user_version_revised" },
      { key: { userId: 1, problemId: 1 }, name: "user_problem" },
    ]),

    db.collection("rateLimits").createIndexes([
      { key: { expiresAt: 1 }, name: "ttl", expireAfterSeconds: 0 },
    ]),
  ]);
}
