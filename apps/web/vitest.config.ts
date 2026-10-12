import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => {
  const migrations = await readD1Migrations(path.join(import.meta.dirname, "migrations"));

  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./wrangler.jsonc" },
        // Test-only bindings: the real migrations for the setup file, and a printer token.
        miniflare: { bindings: { TEST_MIGRATIONS: migrations, PRINTER_TOKEN: "test-printer-token" } },
      }),
    ],
    test: { setupFiles: ["./test/setup.ts"] },
  };
});
