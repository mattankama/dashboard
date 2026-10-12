import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Item, RunReport } from "../src/api.ts";
import { parseConfig, type Config } from "../src/config.ts";
import type { Email, SendResult } from "../src/email.ts";
import { markThisWeekDone, runWeekly, type JobDeps } from "../src/job.ts";
import type { PrinterStatus, PrintResult } from "../src/printer.ts";
import type { State } from "../src/state.ts";
import { memoryLogger } from "./fakes.ts";

// Local times (the test script pins TZ=America/Los_Angeles). The target is Sunday Oct 11, 09:00.
const SUNDAY_0930 = new Date("2026-10-11T09:30:00-07:00");
const MONDAY_0800 = new Date("2026-10-12T08:00:00-07:00"); // 23h after the target: still retrying
const MONDAY_1000 = new Date("2026-10-12T10:00:00-07:00"); // 25h after: email only
const WEEK = "2026-W41";

const ITEM: Item = { id: "a", text: "Call Grandma", category: null, pinned: false, createdAt: "", updatedAt: "", archivedAt: null };
const PDF = Buffer.from("%PDF-1.4 fake");

function fullConfig(): Config {
  const parsed = parseConfig(
    {
      DASHBOARD_API_URL: "http://localhost:8787",
      PRINTER_TOKEN: "t",
      GMAIL_USER: "sender@example.com",
      GMAIL_APP_PASSWORD: "p",
      NOTIFY_TO: "me@example.com",
    },
    "/Users/someone",
  );
  assert.ok(parsed.ok);
  return parsed.config;
}

/** In-memory state with the same behaviour as fileState. */
function memoryState(): State & { done: Map<string, string>; alerts: Set<string>; locked: boolean; sheets: Map<string, Buffer> } {
  const done = new Map<string, string>();
  const alerts = new Set<string>();
  const sheets = new Map<string, Buffer>();
  const state = {
    done,
    alerts,
    sheets,
    locked: false,
    isDone: async (week: string) => done.has(week),
    markDone: async (week: string, status: string) => void done.set(week, status),
    alerted: async (week: string, kind: string) => alerts.has(`${week}-${kind}`),
    markAlerted: async (week: string, kind: string) => void alerts.add(`${week}-${kind}`),
    lock: async () => (state.locked ? false : (state.locked = true)),
    unlock: async () => void (state.locked = false),
    saveSheet: async (date: string, pdf: Buffer) => {
      sheets.set(date, pdf);
      return `/state/sheets/weekly-${date}.pdf`;
    },
    heartbeat: async () => {},
    weekState: async (week: string) => (done.has(week) ? { status: done.get(week)!, at: new Date(0) } : null),
    lastRun: async () => null,
  };
  return state;
}

interface Options {
  now?: Date;
  items?: Item[] | Error;
  sheet?: Error;
  status?: PrinterStatus;
  print?: PrintResult;
  mail?: SendResult;
  recordRun?: Error;
  config?: Config;
}

/** Every effect faked; each call is recorded so tests can check what happened (and what didn't). */
function fakeJob(options: Options = {}) {
  const calls = {
    items: 0,
    sheets: 0,
    prints: [] as string[],
    mails: [] as Email[],
    runs: [] as RunReport[],
    notices: [] as string[],
  };
  const state = memoryState();
  const log = memoryLogger();
  const deps: JobDeps = {
    now: () => options.now ?? SUNDAY_0930,
    config: options.config ?? fullConfig(),
    log,
    state,
    api: {
      activeItems: async () => {
        calls.items++;
        if (options.items instanceof Error) throw options.items;
        return options.items ?? [ITEM];
      },
      recordRun: async (run) => {
        calls.runs.push(run);
        if (options.recordRun) throw options.recordRun;
      },
    },
    makeSheet: async () => {
      calls.sheets++;
      if (options.sheet) throw options.sheet;
      return { pdf: PDF, pages: 1, grouping: "fallback" };
    },
    printer: {
      status: async () => options.status ?? { reachable: true, reason: "the printer answered on the network" },
      print: async (file) => {
        calls.prints.push(file);
        return options.print ?? { ok: true, job: "CanonMF4800-1" };
      },
    },
    mail: async (email) => {
      calls.mails.push(email);
      return options.mail ?? { ok: true };
    },
    notify: async (message) => {
      calls.notices.push(message);
      return true;
    },
  };
  return { deps, calls, state, log };
}

describe("a normal Sunday", () => {
  it("prints, emails the PDF, marks the week done and records the run", async () => {
    const { deps, calls, state } = fakeJob();

    const outcome = await runWeekly(deps, { force: false });

    assert.deepEqual(outcome, { kind: "printed", week: WEEK, emailed: true });
    assert.deepEqual(calls.prints, ["/state/sheets/weekly-2026-10-11.pdf"]);
    assert.equal(calls.mails.length, 1);
    assert.equal(calls.mails[0].subject, "Your dashboard printed");
    assert.equal(calls.mails[0].to, "me@example.com");
    assert.ok(calls.mails[0].attachment.content.equals(PDF));
    assert.equal(calls.mails[0].attachment.filename, "dashboard-2026-10-11.pdf");
    assert.ok(!calls.mails[0].text.includes(ITEM.text), "item text stays in the PDF, not the email body");
    assert.equal(state.done.get(WEEK), "printed");
    assert.deepEqual(calls.runs, [{ week: WEEK, status: "printed", printedAt: SUNDAY_0930.toISOString(), emailedAt: SUNDAY_0930.toISOString() }]);
    assert.deepEqual(calls.notices, []);
    assert.equal(state.locked, false, "the lock is released");
  });

  it("does nothing more once the week is done", async () => {
    const { deps, calls, state } = fakeJob();
    state.done.set(WEEK, "printed");

    assert.deepEqual(await runWeekly(deps, { force: false }), { kind: "already-done", week: WEEK });
    assert.equal(calls.items, 0);
  });

  it("--force runs a done week again", async () => {
    const { deps, calls, state } = fakeJob();
    state.done.set(WEEK, "printed");

    assert.equal((await runWeekly(deps, { force: true })).kind, "printed");
    assert.equal(calls.prints.length, 1);
  });

  it("before 09:00 on Sunday, it's still last week's (already done) sheet", async () => {
    const { deps, state } = fakeJob({ now: new Date("2026-10-11T08:59:00-07:00") });
    state.done.set("2026-W40", "printed");

    assert.deepEqual(await runWeekly(deps, { force: false }), { kind: "already-done", week: "2026-W40" });
  });
});

describe("catching up", () => {
  it("prints Sunday's sheet on Monday morning when the Mac was away", async () => {
    const { deps, calls } = fakeJob({ now: MONDAY_0800 });

    assert.deepEqual(await runWeekly(deps, { force: false }), { kind: "printed", week: WEEK, emailed: true });
    assert.equal(calls.prints.length, 1);
  });
});

describe("when the printer can't be reached", () => {
  const away = { reachable: false, reason: "the printer didn't answer on the network" };

  it("waits and retries within 24 hours, without email or marking done", async () => {
    const { deps, calls, state } = fakeJob({ now: MONDAY_0800, status: away });

    assert.deepEqual(await runWeekly(deps, { force: false }), {
      kind: "waiting-for-printer",
      week: WEEK,
      reason: "the printer didn't answer on the network",
    });
    assert.equal(calls.mails.length, 0);
    assert.equal(state.done.has(WEEK), false);
  });

  it("after 24 hours, emails the sheet instead", async () => {
    const { deps, calls, state } = fakeJob({ now: MONDAY_1000, status: away });

    assert.deepEqual(await runWeekly(deps, { force: false }), { kind: "emailed-only", week: WEEK });
    assert.equal(calls.mails[0].subject, "Couldn't reach the printer; here's your sheet");
    assert.ok(calls.mails[0].attachment.content.equals(PDF));
    assert.equal(state.done.get(WEEK), "emailed_only");
    assert.deepEqual(calls.runs, [{ week: WEEK, status: "emailed_only", printedAt: null, emailedAt: MONDAY_1000.toISOString() }]);
  });

  it("treats a print job that didn't finish like an unreachable printer", async () => {
    const stuck = { ok: false as const, reason: "the print job didn't finish within 5 minutes; cancelled it" };
    const { deps, calls } = fakeJob({ print: stuck });

    assert.deepEqual(await runWeekly(deps, { force: false }), { kind: "waiting-for-printer", week: WEEK, reason: stuck.reason });
    assert.equal(calls.mails.length, 0);
  });

  it("if the fallback email fails too, records the failure and notifies once", async () => {
    const { deps, calls, state } = fakeJob({ now: MONDAY_1000, status: away, mail: { ok: false, reason: "curl failed (exit 67)" } });

    const outcome = await runWeekly(deps, { force: false });

    assert.equal(outcome.kind, "failed");
    assert.equal(state.done.get(WEEK), "failed");
    assert.deepEqual(calls.runs.map((r) => r.status), ["failed"]);
    assert.equal(calls.notices.length, 1);
    assert.match(calls.notices[0], /couldn't print or email this week's sheet.*\/state\/sheets\/weekly-2026-10-11\.pdf/i);
  });
});

describe("other paths", () => {
  it("with no active items, prints and emails nothing and marks the week done", async () => {
    const { deps, calls, state } = fakeJob({ items: [] });

    assert.deepEqual(await runWeekly(deps, { force: false }), { kind: "no-items", week: WEEK });
    assert.equal(calls.sheets, 0);
    assert.equal(calls.prints.length, 0);
    assert.equal(calls.mails.length, 0);
    assert.equal(state.done.get(WEEK), "no-items");
  });

  it("if the email after printing fails, notifies and still counts the week as printed", async () => {
    const { deps, calls, state } = fakeJob({ mail: { ok: false, reason: "curl failed (exit 28): timed out" } });

    assert.deepEqual(await runWeekly(deps, { force: false }), { kind: "printed", week: WEEK, emailed: false });
    assert.equal(state.done.get(WEEK), "printed");
    assert.deepEqual(calls.runs, [{ week: WEEK, status: "printed", printedAt: SUNDAY_0930.toISOString(), emailedAt: null }]);
    assert.equal(calls.notices.length, 1);
    assert.match(calls.notices[0], /printed, but the email couldn't be sent/);
  });

  it("if recording the run fails, logs it and carries on", async () => {
    const { deps, log } = fakeJob({ recordRun: new Error("run request failed: HTTP 503") });

    assert.equal((await runWeekly(deps, { force: false })).kind, "printed");
    assert.ok(log.lines.some((l) => /^WARN couldn't record the run: run request failed: HTTP 503/.test(l)));
  });

  it("another run holding the lock means this one does nothing", async () => {
    const { deps, calls, state } = fakeJob();
    state.locked = true;

    assert.deepEqual(await runWeekly(deps, { force: false }), { kind: "locked" });
    assert.equal(calls.items, 0);
  });
});

describe("failures before there's a sheet", () => {
  it("when the API can't be reached, retries hourly and alerts once after 24 hours", async () => {
    const offline = new Error("items request failed: timed out");

    const early = fakeJob({ now: MONDAY_0800, items: offline });
    assert.deepEqual(await runWeekly(early.deps, { force: false }), { kind: "failed", week: WEEK, reason: offline.message });
    assert.deepEqual(early.calls.notices, []);

    const late = fakeJob({ now: MONDAY_1000, items: offline });
    await runWeekly(late.deps, { force: false });
    await runWeekly(late.deps, { force: false });
    assert.equal(late.calls.notices.length, 1, "one alert, not one an hour");
    assert.match(late.calls.notices[0], /couldn't make this week's sheet/);
    assert.equal(late.state.done.has(WEEK), false, "it keeps trying");
  });

  it("when the PDF can't be made, the same rule applies", async () => {
    const { deps, calls } = fakeJob({ now: MONDAY_1000, sheet: new Error("Chrome failed to make the PDF (timed out)") });

    assert.equal((await runWeekly(deps, { force: false })).kind, "failed");
    assert.equal(calls.notices.length, 1);
  });

  it("missing settings alert once a week instead of failing silently", async () => {
    const parsed = parseConfig({}, "/Users/someone");
    assert.ok(parsed.ok);
    const { deps, calls } = fakeJob({ config: parsed.config });

    const outcome = await runWeekly(deps, { force: false });
    await runWeekly(deps, { force: false });

    assert.deepEqual(outcome, {
      kind: "failed",
      week: WEEK,
      reason: "missing settings: DASHBOARD_API_URL, PRINTER_TOKEN, GMAIL_USER, GMAIL_APP_PASSWORD, NOTIFY_TO",
    });
    assert.equal(calls.items, 0);
    assert.equal(calls.notices.length, 1);
    assert.match(calls.notices[0], /apps\/printer\/\.env/);
  });
});

describe("markThisWeekDone (used by install.sh)", () => {
  it("marks the current week skipped, so installing never prints by surprise", async () => {
    const { deps, state } = fakeJob({ now: MONDAY_0800 });

    assert.equal(await markThisWeekDone(deps.state, deps.now(), deps.config.schedule), WEEK);
    assert.equal(state.done.get(WEEK), "skipped");
  });

  it("leaves a week that's already done alone", async () => {
    const { deps, state } = fakeJob();
    state.done.set(WEEK, "printed");

    await markThisWeekDone(deps.state, deps.now(), deps.config.schedule);
    assert.equal(state.done.get(WEEK), "printed");
  });
});
