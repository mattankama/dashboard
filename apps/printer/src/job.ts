// The weekly run: every decision, with every effect injected (spec: "The weekly run").
// Safe to run every hour: a week is only acted on until it's marked done.
import type { DashboardApi, Item, RunReport } from "./api.ts";
import { missingForRealRun, type Config } from "./config.ts";
import type { Email, SendResult } from "./email.ts";
import type { Logger } from "./log.ts";
import type { PrinterStatus, PrintResult } from "./printer.ts";
import { fileDate, isoWeek, mostRecentTarget, weekRange } from "./schedule.ts";
import type { BuiltSheet } from "./sheet.ts";
import type { State } from "./state.ts";

export interface JobDeps {
  now(): Date;
  config: Config;
  log: Logger;
  state: State;
  api: DashboardApi;
  makeSheet(items: Item[], target: Date, now: Date): Promise<BuiltSheet>;
  printer: { status(): Promise<PrinterStatus>; print(file: string, title: string): Promise<PrintResult> };
  mail(email: Email): Promise<SendResult>;
  notify(message: string): Promise<boolean>;
}

export type Outcome =
  | { kind: "locked" }
  | { kind: "already-done"; week: string }
  | { kind: "no-items"; week: string }
  | { kind: "printed"; week: string; emailed: boolean }
  | { kind: "emailed-only"; week: string }
  | { kind: "waiting-for-printer"; week: string; reason: string }
  | { kind: "failed"; week: string; reason: string };

const DAY_MS = 24 * 60 * 60 * 1000;

const when = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

/**
 * Marks the current week done without printing (install.sh does this, so installing
 * mid-week never prints by surprise). A week that's already done is left as it is.
 */
export async function markThisWeekDone(state: State, now: Date, schedule: Config["schedule"]): Promise<string> {
  const week = isoWeek(mostRecentTarget(now, schedule));
  if (!(await state.isDone(week))) await state.markDone(week, "skipped");
  return week;
}

export async function runWeekly(deps: JobDeps, { force }: { force: boolean }): Promise<Outcome> {
  if (!(await deps.state.lock())) {
    deps.log.info("another run is still going; leaving it to finish");
    return { kind: "locked" };
  }
  try {
    const now = deps.now();
    await deps.state.heartbeat(now);
    return await weekly(deps, now, force);
  } finally {
    await deps.state.unlock();
  }
}

/** Logs a failure; tells Mattan once per week and kind (not every hour) when `alert` is set. */
async function fail(deps: JobDeps, week: string, reason: string, kind: string, alert: boolean, notice: string): Promise<Outcome> {
  deps.log.error(`week ${week}: ${reason}`);
  if (alert && !(await deps.state.alerted(week, kind))) {
    await deps.notify(notice);
    await deps.state.markAlerted(week, kind);
  }
  return { kind: "failed", week, reason };
}

/** Recording the run is a nice-to-have: a failure is logged, never fatal. */
async function record(deps: JobDeps, run: RunReport): Promise<void> {
  try {
    await deps.api.recordRun(run);
  } catch (err) {
    deps.log.warn(`couldn't record the run: ${message(err)}`);
  }
}

async function weekly(deps: JobDeps, now: Date, force: boolean): Promise<Outcome> {
  const { config, log, state } = deps;
  const target = mostRecentTarget(now, config.schedule);
  const week = isoWeek(target);
  if (!force && (await state.isDone(week))) return { kind: "already-done", week };
  const overdue = now.getTime() - target.getTime() >= DAY_MS;

  const missing = missingForRealRun(config);
  if (missing.length > 0) {
    const list = missing.join(", ");
    return fail(deps, week, `missing settings: ${list}`, "config", true, `Dashboard can't print this week's sheet: ${list} missing in apps/printer/.env.`);
  }

  const stuck = (reason: string) =>
    `Dashboard couldn't make this week's sheet for a day (${reason}). It keeps trying every hour.`;
  let items: Item[];
  try {
    items = await deps.api.activeItems();
  } catch (err) {
    return fail(deps, week, message(err), "api", overdue, stuck(message(err)));
  }
  if (items.length === 0) {
    await state.markDone(week, "no-items");
    log.info(`week ${week}: no active items, so no sheet`);
    return { kind: "no-items", week };
  }

  let sheet: BuiltSheet;
  try {
    sheet = await deps.makeSheet(items, target, now);
  } catch (err) {
    return fail(deps, week, message(err), "pdf", overdue, stuck(message(err)));
  }
  const file = await state.saveSheet(fileDate(target), sheet.pdf);
  const mail = (subject: string, text: string): Email => ({
    from: config.gmailUser!,
    to: config.notifyTo!,
    subject,
    text,
    attachment: { filename: `dashboard-${fileDate(target)}.pdf`, content: sheet.pdf },
  });

  let reason: string;
  const status = await deps.printer.status();
  if (status.reachable) {
    const printed = await deps.printer.print(file, `Dashboard ${week}`);
    if (printed.ok) {
      const printedAt = deps.now();
      log.info(`week ${week}: printed ${items.length} items (job ${printed.job}, ${sheet.pages} page${sheet.pages === 1 ? "" : "s"}, grouped by ${sheet.grouping})`);
      const sent = await deps.mail(
        mail("Your dashboard printed", `This week's sheet (${weekRange(target)}) printed ${when.format(printedAt)}. The PDF is attached.\n\n${items.length} items.`),
      );
      if (!sent.ok) {
        log.error(`week ${week}: printed, but the email failed: ${sent.reason}`);
        await deps.notify(`This week's sheet printed, but the email couldn't be sent (${sent.reason}).`);
      }
      await state.markDone(week, "printed");
      await record(deps, { week, status: "printed", printedAt: printedAt.toISOString(), emailedAt: sent.ok ? deps.now().toISOString() : null });
      return { kind: "printed", week, emailed: sent.ok };
    }
    reason = printed.reason;
  } else {
    reason = status.reason;
  }

  if (!overdue) {
    log.info(`week ${week}: can't print yet (${reason}); trying again next hour`);
    return { kind: "waiting-for-printer", week, reason };
  }

  const sent = await deps.mail(
    mail(
      "Couldn't reach the printer; here's your sheet",
      `The printer (${config.printerName}) couldn't be reached since ${when.format(target)} (${reason}), so here's this week's sheet (${weekRange(target)}) as a PDF instead.`,
    ),
  );
  if (sent.ok) {
    log.warn(`week ${week}: no printer for a day (${reason}); emailed the sheet instead`);
    await state.markDone(week, "emailed_only");
    await record(deps, { week, status: "emailed_only", printedAt: null, emailedAt: deps.now().toISOString() });
    return { kind: "emailed-only", week };
  }

  // Nothing reached Mattan: say so the one way left, and stop retrying this week.
  log.error(`week ${week}: couldn't print (${reason}) or email (${sent.reason}); the sheet is at ${file}`);
  await deps.notify(`Dashboard couldn't print or email this week's sheet. It's saved at ${file}.`);
  await state.markDone(week, "failed");
  await record(deps, { week, status: "failed", printedAt: null, emailedAt: null });
  return { kind: "failed", week, reason: `printer: ${reason}; email: ${sent.reason}` };
}
