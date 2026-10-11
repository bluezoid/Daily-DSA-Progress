import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const DB_PORT = 27999;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: `npx tsx scripts/memory-db.ts ${DB_PORT}`,
      port: DB_PORT,
      timeout: 180_000,
      reuseExistingServer: false,
    },
    {
      command: `npx next dev -p ${PORT}`,
      url: `http://localhost:${PORT}`,
      timeout: 180_000,
      reuseExistingServer: false,
      env: {
        MONGODB_URI: `mongodb://127.0.0.1:${DB_PORT}/?replicaSet=rs0`,
        MONGODB_DB_NAME: "dsa_e2e",
        JWT_SECRET: "e2e-secret-that-is-long-enough-0123456789",
        APP_URL: `http://localhost:${PORT}`,
        IMPORT_MOCK: "1",
      },
    },
  ],
});
