// The weekly job's entry point: `node src/weekly.ts [--dry-run] [--force] [--sample]`.
import { homedir } from "node:os";
import path from "node:path";
import { loadEnvFile, parseConfig } from "./config.ts";
import { parseFlags, USAGE } from "./flags.ts";
import { fileLogger } from "./log.ts";

const parsed = parseFlags(process.argv.slice(2));
if (!parsed.ok) {
  console.error(`${parsed.message}\n\n${USAGE}`);
  process.exit(2);
}
if (parsed.flags.help) {
  console.log(USAGE);
  process.exit(0);
}

loadEnvFile(path.join(import.meta.dirname, "..", ".env"));
const config = parseConfig(process.env, homedir());
if (!config.ok) {
  for (const error of config.errors) console.error(error);
  process.exit(1);
}

const log = fileLogger(config.config.logFile);
log.info(`weekly job started${parsed.flags.dryRun ? " (dry run)" : ""}`);
