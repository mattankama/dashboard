// Runs an outside command (Chrome, lp, lpstat, dns-sd, curl, osascript) with a timeout.
// Everything that touches the outside world goes through a Runner, so tests can fake it.
import { spawn } from "node:child_process";

export interface RunResult {
  code: number | null; // null: it couldn't start, or was killed
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

export interface RunOptions {
  input?: string; // written to stdin, then closed
  timeoutMs?: number;
  signal?: AbortSignal; // stops the command early (it's then reported as not finished)
}

export type Runner = (command: string, args: string[], options?: RunOptions) => Promise<RunResult>;

export const run: Runner = (command, args, { input, timeoutMs = 60_000, signal } = {}) =>
  new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));

    const stop = () => {
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 2000).unref();
    };
    const timer = setTimeout(() => {
      timedOut = true;
      stop();
    }, timeoutMs);
    signal?.addEventListener("abort", stop, { once: true });

    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ code: null, stdout, stderr: stderr || err.message, timedOut });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: timedOut ? null : code, stdout, stderr, timedOut });
    });

    child.stdin.on("error", () => {}); // a command that exits early closes its stdin
    child.stdin.end(input ?? "");
  });
