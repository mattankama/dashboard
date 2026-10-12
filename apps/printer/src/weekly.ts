// The weekly job's entry point: `node src/weekly.ts [--dry-run] [--force] [--sample]`.
import Anthropic from "@anthropic-ai/sdk";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { dashboardApi } from "./api.ts";
import { loadEnvFile, missingForDryRun, parseConfig, type Config } from "./config.ts";
import { parseFlags, USAGE, type Flags } from "./flags.ts";
import { fileLogger, type Logger } from "./log.ts";
import { run } from "./run.ts";
import { SAMPLE_ITEMS } from "./sample.ts";
import { fileDate, mostRecentTarget } from "./schedule.ts";
import { buildSheet } from "./sheet.ts";

const APP_DIR = path.join(import.meta.dirname, "..");

function claudeClient(config: Config): Anthropic | null {
  return config.anthropicApiKey ? new Anthropic({ apiKey: config.anthropicApiKey, timeout: 120_000, maxRetries: 2 }) : null;
}

/** Makes this week's sheet as out/weekly-<Sunday>.pdf. Never prints, emails, or marks the week done. */
async function dryRun(config: Config, flags: Flags, log: Logger): Promise<number> {
  const missing = missingForDryRun(config, flags.sample);
  if (missing.length > 0) {
    log.error(`dry run needs ${missing.join(", ")} in apps/printer/.env (or use --sample)`);
    return 1;
  }
  const items = flags.sample ? SAMPLE_ITEMS : await dashboardApi(config.apiUrl!, config.printerToken!).activeItems();
  if (items.length === 0) {
    log.info("dry run: no active items, so there's no sheet this week");
    return 0;
  }

  const now = new Date();
  const target = mostRecentTarget(now, config.schedule);
  const sheet = await buildSheet(items, { target, now, client: claudeClient(config), chromePath: config.chromePath, run, log });
  const file = path.join(APP_DIR, "out", `weekly-${fileDate(target)}.pdf`);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, sheet.pdf);
  log.info(
    `dry run: wrote ${path.relative(APP_DIR, file)} (${items.length} items${flags.sample ? ", sample" : ""}, grouped by ${sheet.grouping === "claude" ? "Claude" : "fallback"}, ${sheet.pages} page${sheet.pages === 1 ? "" : "s"})`,
  );
  return 0;
}

async function main(): Promise<number> {
  const parsed = parseFlags(process.argv.slice(2));
  if (!parsed.ok) {
    console.error(`${parsed.message}\n\n${USAGE}`);
    return 2;
  }
  if (parsed.flags.help) {
    console.log(USAGE);
    return 0;
  }

  loadEnvFile(path.join(APP_DIR, ".env"));
  const config = parseConfig(process.env, homedir());
  if (!config.ok) {
    for (const error of config.errors) console.error(error);
    return 1;
  }
  const log = fileLogger(config.config.logFile);

  if (parsed.flags.dryRun) return dryRun(config.config, parsed.flags, log);
  log.error("the real weekly run isn't built yet (Phase 2, Task 9); use --dry-run");
  return 1;
}

process.exitCode = await main();
