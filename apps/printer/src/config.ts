import { existsSync } from "node:fs";
import path from "node:path";

export interface Schedule {
  weekday: number; // 0 = Sunday, as Date#getDay()
  hour: number;
  minute: number;
}

export interface Config {
  apiUrl: string | null;
  printerToken: string | null;
  anthropicApiKey: string | null;
  gmailUser: string | null;
  gmailAppPassword: string | null;
  notifyTo: string | null;
  schedule: Schedule;
  printerName: string;
  chromePath: string;
  stateDir: string;
  logFile: string;
}

export type ConfigResult = { ok: true; config: Config } | { ok: false; errors: string[] };

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const FULL_DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const ADDRESS = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/;

/** Loads `.env` into process.env if the file exists (Node's built-in loader). */
export function loadEnvFile(file: string): void {
  if (existsSync(file)) process.loadEnvFile(file);
}

function value(env: Record<string, string | undefined>, name: string): string | null {
  const raw = env[name]?.trim();
  return raw ? raw : null;
}

/**
 * Reads settings from the environment. Error messages name the setting but
 * never repeat its value, so a secret pasted into the wrong place isn't logged.
 */
export function parseConfig(env: Record<string, string | undefined>, home: string): ConfigResult {
  const errors: string[] = [];

  const dayText = (value(env, "PRINT_DAY") ?? "Sun").toLowerCase();
  let weekday = DAYS.indexOf(dayText);
  if (weekday === -1) weekday = FULL_DAYS.indexOf(dayText);
  if (weekday === -1) errors.push("PRINT_DAY must be a day of the week, like Sun");

  const time = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value(env, "PRINT_TIME") ?? "09:00");
  if (!time) errors.push("PRINT_TIME must be 24-hour HH:MM, like 09:00");

  const apiUrl = value(env, "DASHBOARD_API_URL");
  if (apiUrl !== null && !/^https?:\/\/[^\s]+$/.test(apiUrl)) errors.push("DASHBOARD_API_URL must be an http(s) URL");

  const gmailUser = value(env, "GMAIL_USER");
  if (gmailUser !== null && !ADDRESS.test(gmailUser)) errors.push("GMAIL_USER must be one email address");

  const notifyTo = value(env, "NOTIFY_TO");
  if (notifyTo !== null && !ADDRESS.test(notifyTo)) errors.push("NOTIFY_TO must be one email address");

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    config: {
      apiUrl: apiUrl?.replace(/\/+$/, "") ?? null,
      printerToken: value(env, "PRINTER_TOKEN"),
      anthropicApiKey: value(env, "ANTHROPIC_API_KEY"),
      gmailUser,
      gmailAppPassword: value(env, "GMAIL_APP_PASSWORD"),
      notifyTo,
      schedule: { weekday, hour: Number(time![1]), minute: Number(time![2]) },
      printerName: value(env, "PRINTER_NAME") ?? "CanonMF4800",
      chromePath: value(env, "CHROME_PATH") ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      stateDir: value(env, "DASHBOARD_STATE_DIR") ?? path.join(home, "Library", "Application Support", "dashboard"),
      logFile: value(env, "DASHBOARD_LOG_FILE") ?? path.join(home, "Library", "Logs", "dashboard.log"),
    },
  };
}

/** Settings a real (printing, emailing) run can't do without. Claude is optional. */
export function missingForRealRun(config: Config): string[] {
  const needed: [string, string | null][] = [
    ["DASHBOARD_API_URL", config.apiUrl],
    ["PRINTER_TOKEN", config.printerToken],
    ["GMAIL_USER", config.gmailUser],
    ["GMAIL_APP_PASSWORD", config.gmailAppPassword],
    ["NOTIFY_TO", config.notifyTo],
  ];
  return needed.filter(([, setting]) => setting === null).map(([name]) => name);
}

/** A dry run only needs the API, and not even that with the sample items. */
export function missingForDryRun(config: Config, sample: boolean): string[] {
  if (sample) return [];
  return missingForRealRun(config).filter((name) => name === "DASHBOARD_API_URL" || name === "PRINTER_TOKEN");
}
