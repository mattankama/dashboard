// A macOS notification: the last resort when even the email can't go out.
import type { Runner } from "./run.ts";

/**
 * The title and message are passed as arguments to a fixed script, never spliced
 * into it, so text with quotes can't change what the script does.
 */
export async function notify(title: string, message: string, { run }: { run: Runner }): Promise<boolean> {
  const result = await run(
    "osascript",
    ["-e", "on run argv", "-e", "display notification (item 2 of argv) with title (item 1 of argv)", "-e", "end run", title, message],
    { timeoutMs: 10_000 },
  );
  return result.code === 0;
}
