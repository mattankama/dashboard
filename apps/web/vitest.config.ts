import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => {
  const migrations = await readD1Migrations(path.join(import.meta.dirname, "migrations"));

  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./wrangler.jsonc" },
        // Test-only bindings: the real migrations for the setup file and a printer token.
        // The login starts unset whatever .dev.vars says; tests that need it set it.
        miniflare: {
          bindings: { TEST_MIGRATIONS: migrations, PRINTER_TOKEN: "test-printer-token", LOGIN_PASSWORD: "", SESSION_SECRET: "" },
        },
      }),
    ],
    test: { setupFiles: ["./test/setup.ts"] },
  };
});
