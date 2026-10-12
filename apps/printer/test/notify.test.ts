import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { notify } from "../src/notify.ts";
import { run, type Runner } from "../src/run.ts";

describe("notify", () => {
  it("passes the title and message as arguments, never as script", async () => {
    const calls: string[][] = [];
    const fake: Runner = async (command, args) => {
      calls.push([command, ...args]);
      return { code: 0, stdout: "", stderr: "", timedOut: false };
    };

    const shown = await notify("Dashboard", 'Couldn\'t send "the" email', { run: fake });

    assert.equal(shown, true);
    assert.deepEqual(calls[0], [
      "osascript",
      "-e",
      "on run argv",
      "-e",
      "display notification (item 2 of argv) with title (item 1 of argv)",
      "-e",
      "end run",
      "Dashboard",
      'Couldn\'t send "the" email',
    ]);
  });

  it("the argv form is valid AppleScript (checked with a script that shows nothing)", async () => {
    const result = await run("osascript", ["-e", "on run argv", "-e", 'return (item 2 of argv) & "|" & (item 1 of argv)', "-e", "end run", "Dashboard", 'a "quoted" message']);
    assert.equal(result.stdout.trim(), 'a "quoted" message|Dashboard');
  });
});
