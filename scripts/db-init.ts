// Creates collections and indexes. Run once per environment: `npm run db:init`.
import { MongoClient } from "mongodb";
import { ensureIndexes } from "../src/lib/mongodb/indexes";

async function main() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME || "daily_dsa_progress";
  if (!uri) throw new Error("MONGODB_URI is not set (put it in .env.local or the shell environment)");
  const client = await new MongoClient(uri).connect();
  try {
    await ensureIndexes(client.db(dbName));
    console.log(`Indexes ensured on database "${dbName}".`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
