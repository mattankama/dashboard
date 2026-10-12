// What the job remembers between hourly runs, in ~/Library/Application Support/dashboard/:
//   weeks/<week>          done markers        alerts/<week>-<kind>  "already told Mattan"
//   sheets/<date>.pdf     each week's sheet   weekly.lock           one run at a time
//   last-run              heartbeat (when the job last ran)
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export interface State {
  isDone(week: string): Promise<boolean>;
  markDone(week: string, status: string): Promise<void>;
  alerted(week: string, kind: string): Promise<boolean>;
  markAlerted(week: string, kind: string): Promise<void>;
  lock(): Promise<boolean>;
  unlock(): Promise<void>;
  saveSheet(date: string, pdf: Buffer): Promise<string>;
  heartbeat(at: Date): Promise<void>;
  weekState(week: string): Promise<{ status: string; at: Date } | null>;
  lastRun(): Promise<Date | null>;
}

const STALE_MS = 2 * 60 * 60 * 1000;

const exists = (file: string) => stat(file).then(() => true, () => false);

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === "EPERM"; // exists, but isn't ours
  }
}

export function fileState(dir: string, { now = () => new Date() }: { now?: () => Date } = {}): State {
  const at = (...parts: string[]) => path.join(dir, ...parts);
  const write = async (file: string, content: string | Buffer, flag = "w") => {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content, { flag });
  };
  const lockFile = at("weekly.lock");

  async function takeLock(): Promise<boolean> {
    try {
      await write(lockFile, JSON.stringify({ pid: process.pid, startedAt: now().toISOString() }), "wx");
      return true;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
      return false;
    }
  }

  return {
    isDone: (week) => exists(at("weeks", week)),
    markDone: (week, status) => write(at("weeks", week), `${status} ${now().toISOString()}\n`),
    alerted: (week, kind) => exists(at("alerts", `${week}-${kind}`)),
    markAlerted: (week, kind) => write(at("alerts", `${week}-${kind}`), `${now().toISOString()}\n`),

    async lock() {
      if (await takeLock()) return true;
      // A lock left by a run that crashed, or that's been going for hours, is taken over.
      const held = JSON.parse(await readFile(lockFile, "utf8").catch(() => "{}")) as { pid?: number; startedAt?: string };
      const age = now().getTime() - new Date(held.startedAt ?? 0).getTime();
      if (age < STALE_MS && typeof held.pid === "number" && alive(held.pid)) return false;
      await rm(lockFile, { force: true });
      return takeLock();
    },
    unlock: () => rm(lockFile, { force: true }),

    async saveSheet(date, pdf) {
      const file = at("sheets", `weekly-${date}.pdf`);
      await write(file, pdf);
      return file;
    },
    heartbeat: (when) => write(at("last-run"), `${when.toISOString()}\n`),

    async weekState(week) {
      const text = await readFile(at("weeks", week), "utf8").catch(() => null);
      if (text === null) return null;
      const [status, when] = text.trim().split(" ");
      return { status, at: new Date(when) };
    },
    async lastRun() {
      const text = await readFile(at("last-run"), "utf8").catch(() => null);
      return text === null ? null : new Date(text.trim());
    },
  };
}
