import "server-only";
import type { ClientSession, Collection, MongoClient } from "mongodb";
import { getDb, getMongoClient } from "./client";
import { ensureIndexes } from "./indexes";
import type {
  ProblemDoc,
  RateLimitDoc,
  RevisionSessionDoc,
  SolutionVersionDoc,
  UserDoc,
} from "@/types/domain";

export interface Collections {
  users: Collection<UserDoc>;
  problems: Collection<ProblemDoc>;
  solutionVersions: Collection<SolutionVersionDoc>;
  revisionSessions: Collection<RevisionSessionDoc>;
  rateLimits: Collection<RateLimitDoc>;
}

const globalForIndexes = globalThis as unknown as { __dsaIndexes?: Promise<void> };

export async function collections(): Promise<Collections> {
  const db = await getDb();
  // Safety net: create indexes once per server instance. `npm run db:init` does this ahead of time.
  if (!globalForIndexes.__dsaIndexes) {
    globalForIndexes.__dsaIndexes = ensureIndexes(db).catch((err) => {
      globalForIndexes.__dsaIndexes = undefined;
      throw err;
    });
  }
  await globalForIndexes.__dsaIndexes;
  return {
    users: db.collection<UserDoc>("users"),
    problems: db.collection<ProblemDoc>("problems"),
    solutionVersions: db.collection<SolutionVersionDoc>("solutionVersions"),
    revisionSessions: db.collection<RevisionSessionDoc>("revisionSessions"),
    rateLimits: db.collection<RateLimitDoc>("rateLimits"),
  };
}

/** Runs `fn` inside a transaction (retried on transient errors by the driver). */
export async function withTransaction<T>(fn: (session: ClientSession) => Promise<T>): Promise<T> {
  const client: MongoClient = await getMongoClient();
  const session = client.startSession();
  try {
    return await session.withTransaction(fn, {
      readConcern: { level: "snapshot" },
      writeConcern: { w: "majority" },
    });
  } finally {
    await session.endSession();
  }
}

export function resetIndexCache() {
  globalForIndexes.__dsaIndexes = undefined;
}
