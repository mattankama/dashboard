// Date logic for the weekly sheet. All in local time: "Sunday 09:00" means 09:00
// on the Mac's clock, whatever daylight saving is doing.
import type { Schedule } from "./config.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The most recent scheduled time at or before `now`. The job prints for this
 * target, so a Mac that was away on Sunday catches up when it's next home.
 */
export function mostRecentTarget(now: Date, schedule: Schedule): Date {
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), schedule.hour, schedule.minute);
  target.setDate(target.getDate() - ((target.getDay() - schedule.weekday + 7) % 7));
  // setDate keeps the local time of day, so 09:00 stays 09:00 across DST changes.
  if (target > now) target.setDate(target.getDate() - 7);
  return target;
}

/** The ISO 8601 week of a local date, e.g. "2026-W41". */
export function isoWeek(date: Date): string {
  // Work on the local calendar date as a UTC date, so DST can't shift the day.
  const day = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const weekday = day.getUTCDay() || 7; // Monday = 1 ... Sunday = 7
  day.setUTCDate(day.getUTCDate() + 4 - weekday); // the Thursday of this ISO week decides its year
  const yearStart = Date.UTC(day.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((day.getTime() - yearStart) / DAY_MS + 1) / 7);
  return `${day.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

const monthDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const monthDayYear = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

/** The sheet's header: the Sunday it prints and the Saturday after, e.g. "Oct 11 – Oct 17, 2026". */
export function weekRange(start: Date): string {
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  if (end.getFullYear() !== start.getFullYear()) return `${monthDayYear.format(start)} – ${monthDayYear.format(end)}`;
  return `${monthDay.format(start)} – ${monthDay.format(end)}, ${start.getFullYear()}`;
}

const printed = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" });

/** The footer's date, e.g. "Sun Oct 11". */
export function printedLabel(date: Date): string {
  return printed.format(date).replace(",", "");
}

/** A local YYYY-MM-DD, for file names. */
export function fileDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
