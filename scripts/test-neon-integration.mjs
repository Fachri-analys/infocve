import fs from "node:fs";
import { spawnSync } from "node:child_process";

const envFile = new URL("../.env.local", import.meta.url);
if (!process.env.TEST_DATABASE_URL && fs.existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) {
  console.error("Neon integration test needs TEST_DATABASE_URL in .env.local or the process environment.");
  process.exit(1);
}

const productionUrls = [process.env.DATABASE_URL, process.env.POSTGRES_URL].filter(Boolean);
if (productionUrls.includes(databaseUrl)) {
  console.error("Refusing Neon integration tests: TEST_DATABASE_URL matches a configured application database URL.");
  process.exit(1);
}

const result = spawnSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "__tests__/scan-repository.neon.test.ts", "__tests__/neon-catalog.integration.test.ts"], {
  stdio: "inherit",
  env: { ...process.env, TEST_DATABASE_URL: databaseUrl },
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
