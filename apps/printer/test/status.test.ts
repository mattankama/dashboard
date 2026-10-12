import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseConfig } from "../src/config.ts";
import { formatStatus, gatherStatus, type StatusInfo } from "../src/status.ts";
import type { Runner } from "../src/run.ts";

const NOW = new Date("2026-10-12T10:00:00-07:00"); // Monday morning

function info(overrides: Partial<StatusInfo> = {}): StatusInfo {
  return {
    now: NOW,
    nextTarget: new Date("2026-10-18T09:00:00-07:00"),
    week: "2026-W41",
    weekState: { status: "printed", at: new Date("2026-10-11T09:02:00-07:00") },
    lastRun: new Date("2026-10-12T09:48:00-07:00"),
    installed: true,
    missing: [],
    grouping: true,
    printer: { reachable: true, reason: "the printer answered on the network" },
    printerName: "CanonMF4800",
    web: { ok: true, items: 9 },
    ...overrides,
  };
}

describe("formatStatus", () => {
  it("reads as a short plain-English report when all is well", () => {
    assert.equal(
      formatStatus(info()),
      [
        "Dashboard: weekly sheet",
        "",
        "  Next sheet   Sunday, October 18 at 9:00 AM",
        "  This week    printed Sunday, October 11 at 9:02 AM",
        "  Last run     12 minutes ago",
        "  Installed    yes, runs every hour",
        "  Settings     all set",
        "  Grouping     by Claude",
        "  Printer      CanonMF4800 answers",
        "  Web app      answers (9 active items)",
        "",
      ].join("\n"),
    );
  });

  it("says what's wrong or missing, in plain words", () => {
    const text = formatStatus(
      info({
        weekState: null,
        lastRun: null,
        installed: false,
        missing: ["GMAIL_USER", "NOTIFY_TO"],
        grouping: false,
        printer: { reachable: false, reason: "the printer didn't answer on the network" },
        web: { ok: false, reason: "items request failed: timed out" },
      }),
    );

    assert.match(text, /This week {4}not done yet: it prints at the next run that can reach the printer/);
    assert.match(text, /Last run {5}never/);
    assert.match(text, /Installed {4}no: run \.\/install\.sh/);
    assert.match(text, /Settings {5}missing GMAIL_USER, NOTIFY_TO in apps\/printer\/\.env/);
    assert.match(text, /Grouping {5}one plain list \(no ANTHROPIC_API_KEY\)/);
    assert.match(text, /Printer {6}CanonMF4800 doesn't answer: the printer didn't answer on the network/);
    assert.match(text, /Web app {6}doesn't answer: items request failed: timed out/);
  });

  it("names each kind of finished week", () => {
    const at = new Date("2026-10-11T09:00:00-07:00");
    const line = (status: string) => formatStatus(info({ weekState: { status, at } })).split("\n")[3];

    assert.match(line("emailed_only"), /emailed Sunday, October 11 at 9:00 AM \(the printer couldn't be reached\)/);
    assert.match(line("no-items"), /nothing to print \(no active items\)/);
    assert.match(line("failed"), /failed: see ~\/Library\/Logs\/dashboard\.log/);
    assert.match(line("skipped"), /skipped \(marked done when the job was installed\)/);
  });

  it("handles a web app that isn't set up yet", () => {
    assert.match(formatStatus(info({ web: null })), /Web app {6}not set up \(DASHBOARD_API_URL and PRINTER_TOKEN\)/);
  });
});

describe("gatherStatus", () => {
  it("collects the facts without side effects", async () => {
    const parsed = parseConfig({ DASHBOARD_API_URL: "http://localhost:8787", PRINTER_TOKEN: "t" }, "/Users/someone");
    assert.ok(parsed.ok);
    const commands: string[] = [];
    const run: Runner = async (command, args) => {
      commands.push([command, ...args].join(" "));
      return { code: 0, stdout: "", stderr: "", timedOut: false };
    };

    const result = await gatherStatus({
      now: () => NOW,
      config: parsed.config,
      run,
      uid: 501,
      state: {
        weekState: async (week) => (week === "2026-W41" ? { status: "printed", at: new Date("2026-10-11T16:02:00Z") } : null),
        lastRun: async () => new Date("2026-10-12T16:48:00Z"),
      },
      printerStatus: async () => ({ reachable: true, reason: "ok" }),
      activeItems: async () => [],
    });

    assert.equal(result.week, "2026-W41");
    assert.equal(result.nextTarget.toISOString(), "2026-10-18T16:00:00.000Z");
    assert.equal(result.installed, true);
    assert.deepEqual(result.missing, ["GMAIL_USER", "GMAIL_APP_PASSWORD", "NOTIFY_TO"]);
    assert.deepEqual(result.web, { ok: true, items: 0 });
    assert.deepEqual(commands, ["launchctl print gui/501/org.dashboard.weekly"]);
  });
});
