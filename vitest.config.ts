import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    globalSetup: ["tests/setup/global-setup.ts"],
    setupFiles: ["tests/setup/env.ts"],
    // Integration tests share one in-memory replica set; run files serially.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
    server: { deps: { inline: ["server-only"] } },
  },
  resolve: {
    alias: { "server-only": new URL("./tests/setup/server-only-stub.ts", import.meta.url).pathname },
  },
});
