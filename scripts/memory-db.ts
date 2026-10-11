// Local throwaway MongoDB replica set (for E2E tests or trying the app without Atlas).
// Usage: npx tsx scripts/memory-db.ts [port]
import { MongoMemoryReplSet } from "mongodb-memory-server";

const port = Number(process.argv[2] ?? 27999);

async function main() {
  const rs = await MongoMemoryReplSet.create({
    replSet: { count: 1, name: "rs0", storageEngine: "wiredTiger" },
    instanceOpts: [{ port }],
  });
  console.log(`MongoDB replica set ready: ${rs.getUri()}`);
  const stop = async () => {
    await rs.stop();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
