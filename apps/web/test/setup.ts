import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { beforeEach } from "vitest";

// Setup files can run more than once; applyD1Migrations skips migrations already applied.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);

// Storage isn't isolated per test, so every test starts with empty tables.
beforeEach(async () => {
  await env.DB.batch([env.DB.prepare("DELETE FROM items"), env.DB.prepare("DELETE FROM print_runs")]);
});
