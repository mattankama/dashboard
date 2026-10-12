import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileState } from "../src/state.ts";

const freshDir = () => mkdtempSync(path.join(tmpdir(), "dash-state-"));

describe("done markers", () => {
  it("remember a week once it's marked done", async () => {
    const state = fileState(freshDir());

    assert.equal(await state.isDone("2026-W41"), false);
    await state.markDone("2026-W41", "printed");
    assert.equal(await state.isDone("2026-W41"), true);
    assert.equal(await state.isDone("2026-W42"), false);
  });
});

describe("alerts", () => {
  it("are remembered per week and per kind, so a problem alerts once", async () => {
    const state = fileState(freshDir());

    assert.equal(await state.alerted("2026-W41", "api"), false);
    await state.markAlerted("2026-W41", "api");
    assert.equal(await state.alerted("2026-W41", "api"), true);
    assert.equal(await state.alerted("2026-W41", "pdf"), false);
  });
});

describe("the lock", () => {
  it("lets one run in at a time", async () => {
    const dir = freshDir();
    const first = fileState(dir);
    const second = fileState(dir);

    assert.equal(await first.lock(), true);
    assert.equal(await second.lock(), false);
    await first.unlock();
    assert.equal(await second.lock(), true);
  });

  it("is taken over when it's older than two hours", async () => {
    const dir = freshDir();
    writeFileSync(path.join(dir, "weekly.lock"), JSON.stringify({ pid: process.pid, startedAt: "2026-10-11T00:00:00.000Z" }));
    const state = fileState(dir, { now: () => new Date("2026-10-11T03:00:00.000Z") });

    assert.equal(await state.lock(), true);
  });

  it("is taken over when the run that held it is gone", async () => {
    const dir = freshDir();
    writeFileSync(path.join(dir, "weekly.lock"), JSON.stringify({ pid: 999_999_999, startedAt: new Date().toISOString() }));

    assert.equal(await fileState(dir).lock(), true);
  });
});

describe("files", () => {
  it("keeps the week's PDF and a heartbeat in the state folder", async () => {
    const dir = freshDir();
    const state = fileState(dir);

    const file = await state.saveSheet("2026-10-11", Buffer.from("%PDF-1.4"));
    await state.heartbeat(new Date("2026-10-11T16:00:00.000Z"));

    assert.equal(file, path.join(dir, "sheets", "weekly-2026-10-11.pdf"));
    assert.equal(readFileSync(file, "latin1"), "%PDF-1.4");
    assert.equal(readFileSync(path.join(dir, "last-run"), "utf8").trim(), "2026-10-11T16:00:00.000Z");
    assert.ok(existsSync(path.join(dir, "sheets")));
  });
});

describe("reading state back (for --status)", () => {
  it("returns a week's status and time, and the last run", async () => {
    const dir = freshDir();
    const state = fileState(dir, { now: () => new Date("2026-10-11T16:02:00.000Z") });

    assert.equal(await state.weekState("2026-W41"), null);
    assert.equal(await state.lastRun(), null);
    await state.markDone("2026-W41", "printed");
    await state.heartbeat(new Date("2026-10-11T17:00:00.000Z"));

    assert.deepEqual(await state.weekState("2026-W41"), { status: "printed", at: new Date("2026-10-11T16:02:00.000Z") });
    assert.deepEqual(await state.lastRun(), new Date("2026-10-11T17:00:00.000Z"));
  });
});
