import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";

export interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

type Level = "INFO" | "WARN" | "ERROR";

/**
 * Appends timestamped lines to the log file (and echoes them for manual runs).
 * Callers keep item text and secrets out of messages.
 */
export function fileLogger(file: string, { echo = true, now = () => new Date() } = {}): Logger {
  mkdirSync(path.dirname(file), { recursive: true });
  const write = (level: Level, message: string) => {
    const line = `${now().toISOString()} ${level.padEnd(5)} ${message}`;
    appendFileSync(file, `${line}\n`);
    if (echo) (level === "INFO" ? console.log : console.error)(line);
  };
  return {
    info: (message) => write("INFO", message),
    warn: (message) => write("WARN", message),
    error: (message) => write("ERROR", message),
  };
}
