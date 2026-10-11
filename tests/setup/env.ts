import { inject } from "vitest";

process.env.MONGODB_URI = inject("mongoUri");
process.env.MONGODB_DB_NAME = "dsa_test";
process.env.JWT_SECRET = "test-secret-that-is-definitely-longer-than-32-chars";
process.env.APP_URL = "http://localhost:3000";
