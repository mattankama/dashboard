import { parseArgs } from "node:util";

export interface Flags {
  dryRun: boolean;
  force: boolean;
  sample: boolean;
  help: boolean;
  status: boolean;
  markDone: boolean;
}

export const USAGE = `Usage: node src/weekly.ts [--dry-run] [--force] [--sample]

  (no flags)  The weekly job: print and email this week's sheet if it's due.
  --dry-run   Only write the PDF to out/. No printing, email, or marking the week done.
  --force     Ignore "already done this week" (with --dry-run: just make the PDF).
  --sample    Use built-in example items instead of the API (implies --dry-run).
  --status    Show a health check: next print, this week, last run, settings, printer, web app.
  --mark-done Mark this week done without printing (install.sh uses this).
  --help      Show this.`;

export function parseFlags(argv: string[]): { ok: true; flags: Flags } | { ok: false; message: string } {
  try {
    const { values } = parseArgs({
      args: argv,
      options: {
        "dry-run": { type: "boolean", default: false },
        force: { type: "boolean", default: false },
        sample: { type: "boolean", default: false },
        help: { type: "boolean", default: false },
        status: { type: "boolean", default: false },
        "mark-done": { type: "boolean", default: false },
      },
      strict: true,
      allowPositionals: false,
    });
    const sample = values.sample === true;
    return {
      ok: true,
      // Sample items must never reach the printer.
      flags: {
        dryRun: values["dry-run"] === true || sample,
        force: values.force === true,
        sample,
        help: values.help === true,
        status: values.status === true,
        markDone: values["mark-done"] === true,
      },
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}
