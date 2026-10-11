import "server-only";
import { MongoClient, type Db } from "mongodb";
import { env } from "@/lib/env";

type MongoCache = { uri: string; promise: Promise<MongoClient> };

// Cached on globalThis so dev hot reloads and warm serverless invocations reuse one pool.
const globalForMongo = globalThis as unknown as { __mongo?: MongoCache };

export function getMongoClient(): Promise<MongoClient> {
  const { MONGODB_URI } = env();
  const existing = globalForMongo.__mongo;
  if (existing && existing.uri === MONGODB_URI) return existing.promise;

  const client = new MongoClient(MONGODB_URI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 8_000,
    appName: "daily-dsa-progress",
  });
  const promise = client.connect().catch((err) => {
    globalForMongo.__mongo = undefined;
    throw err;
  });
  globalForMongo.__mongo = { uri: MONGODB_URI, promise };
  return promise;
}

export async function getDb(): Promise<Db> {
  const client = await getMongoClient();
  return client.db(env().MONGODB_DB_NAME);
}

/** Closes the cached client (used by tests and scripts). */
export async function closeMongo() {
  const existing = globalForMongo.__mongo;
  globalForMongo.__mongo = undefined;
  if (existing) await (await existing.promise).close();
}
