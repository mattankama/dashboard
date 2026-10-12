// `npm run status`: a plain-English health check. It only looks; it never prints,
// emails, marks anything done or notifies.
import type { Item } from "./api.ts";
import { missingForRealRun, type Config } from "./config.ts";
import type { PrinterStatus } from "./printer.ts";
import type { Runner } from "./run.ts";
import { isoWeek, mostRecentTarget } from "./schedule.ts";
import type { State } from "./state.ts";

export const LABEL = "org.dashboard.weekly";

export interface StatusInfo {
  now: Date;
  nextTarget: Date;
  week: string;
  weekState: { status: string; at: Date } | null;
  lastRun: Date | null;
  installed: boolean | null; // null: couldn't tell
  missing: string[];
  grouping: boolean;
  printer: PrinterStatus;
  printerName: string;
  web: { ok: true; items: number } | { ok: false; reason: string } | null; // null: not set up
}

export async function gatherStatus(deps: {
  now: () => Date;
  config: Config;
  run: Runner;
  uid: number;
  state: Pick<State, "weekState" | "lastRun">;
  printerStatus: () => Promise<PrinterStatus>;
  activeItems: (() => Promise<Item[]>) | null;
}): Promise<StatusInfo> {
  const now = deps.now();
  const target = mostRecentTarget(now, deps.config.schedule);
  const nextTarget = new Date(target);
  nextTarget.setDate(nextTarget.getDate() + 7);
  const week = isoWeek(target);

  const launchd = await deps.run("launchctl", ["print", `gui/${deps.uid}/${LABEL}`], { timeoutMs: 10_000 });
  let web: StatusInfo["web"] = null;
  if (deps.activeItems) {
    web = await deps.activeItems().then(
      (items) => ({ ok: true as const, items: items.length }),
      (err: unknown) => ({ ok: false as const, reason: err instanceof Error ? err.message : String(err) }),
    );
  }

  return {
    now,
    nextTarget,
    week,
    weekState: await deps.state.weekState(week),
    lastRun: await deps.state.lastRun(),
    installed: launchd.code === null ? null : launchd.code === 0,
    missing: missingForRealRun(deps.config),
    grouping: deps.config.anthropicApiKey !== null,
    printer: await deps.printerStatus(),
    printerName: deps.config.printerName,
    web,
  };
}

const when = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });

function ago(then: Date, now: Date): string {
  const minutes = Math.round((now.getTime() - then.getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return `${Math.round(hours / 24)} days ago`;
}

function weekLine(state: StatusInfo["weekState"]): string {
  if (state === null) return "not done yet: it prints at the next run that can reach the printer";
  const at = when.format(state.at);
  switch (state.status) {
    case "printed":
      return `printed ${at}`;
    case "emailed_only":
      return `emailed ${at} (the printer couldn't be reached)`;
    case "no-items":
      return "nothing to print (no active items)";
    case "failed":
      return "failed: see ~/Library/Logs/dashboard.log";
    case "skipped":
      return "skipped (marked done when the job was installed)";
    default:
      return `${state.status} ${at}`;
  }
}

export function formatStatus(info: StatusInfo): string {
  const rows: [string, string][] = [
    ["Next sheet", when.format(info.nextTarget)],
    ["This week", weekLine(info.weekState)],
    ["Last run", info.lastRun ? ago(info.lastRun, info.now) : "never"],
    ["Installed", info.installed === null ? "couldn't tell (launchctl didn't answer)" : info.installed ? "yes, runs every hour" : "no: run ./install.sh"],
    ["Settings", info.missing.length === 0 ? "all set" : `missing ${info.missing.join(", ")} in apps/printer/.env`],
    ["Grouping", info.grouping ? "by Claude" : "one plain list (no ANTHROPIC_API_KEY)"],
    ["Printer", info.printer.reachable ? `${info.printerName} answers` : `${info.printerName} doesn't answer: ${info.printer.reason}`],
    [
      "Web app",
      info.web === null
        ? "not set up (DASHBOARD_API_URL and PRINTER_TOKEN)"
        : info.web.ok
          ? `answers (${info.web.items} active item${info.web.items === 1 ? "" : "s"})`
          : `doesn't answer: ${info.web.reason}`,
    ],
  ];
  return ["Dashboard: weekly sheet", "", ...rows.map(([label, value]) => `  ${label.padEnd(12)} ${value}`), ""].join("\n");
}
