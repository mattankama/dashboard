import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { printPdf, printerStatus } from "../src/printer.ts";
import type { RunResult, Runner } from "../src/run.ts";

type Call = { command: string; args: string[] };
const ok = (stdout = ""): RunResult => ({ code: 0, stdout, stderr: "", timedOut: false });
const fail = (stderr: string, code = 1): RunResult => ({ code, stdout: "", stderr, timedOut: false });

/** A fake command runner: `answer` decides each command's result. Nothing real runs. */
function fakeRunner(answer: (call: Call, calls: Call[]) => RunResult) {
  const calls: Call[] = [];
  const runner: Runner = async (command, args) => {
    const call = { command, args };
    calls.push(call);
    return answer(call, calls);
  };
  return { runner, calls };
}

const ENABLED = "printer CanonMF4800 is idle.  enabled since Mon Sep 28 17:15:49 2026\n";
const DEVICE = "device for CanonMF4800: dnssd://CanonMF4800._pdl-datastream._tcp.local./?bidi\n";
const FOUND = "Lookup CanonMF4800._pdl-datastream._tcp.local.\n...STARTING...\nCanonMF4800._pdl-datastream._tcp.local. can be reached at Canon5f584d.local.:9100 (interface 12)\n";

function statusRunner(overrides: Partial<Record<"p" | "v" | "dns", RunResult>> = {}) {
  return fakeRunner(({ command, args }) => {
    if (command === "lpstat" && args[0] === "-p") return overrides.p ?? ok(ENABLED);
    if (command === "lpstat" && args[0] === "-v") return overrides.v ?? ok(DEVICE);
    if (command === "dns-sd") return overrides.dns ?? ok(FOUND);
    throw new Error(`unexpected command ${command}`);
  });
}

describe("printerStatus", () => {
  it("is reachable when the queue is enabled and Bonjour answers", async () => {
    const { runner, calls } = statusRunner();

    assert.deepEqual(await printerStatus("CanonMF4800", { run: runner }), { reachable: true, reason: "the printer answered on the network" });
    assert.deepEqual(calls.at(-1), { command: "dns-sd", args: ["-L", "CanonMF4800", "_pdl-datastream._tcp", "local."] });
  });

  it("isn't reachable when the queue is disabled", async () => {
    const { runner } = statusRunner({ p: ok("printer CanonMF4800 disabled since Sun Oct 11 09:00:00 2026 -\n\tPaused\n") });

    assert.deepEqual(await printerStatus("CanonMF4800", { run: runner }), { reachable: false, reason: "the CanonMF4800 queue is disabled" });
  });

  it("isn't reachable when there's no such queue", async () => {
    const { runner } = statusRunner({ p: fail("lpstat: Invalid destination name in list \"Nope\".") });

    assert.deepEqual(await printerStatus("Nope", { run: runner }), { reachable: false, reason: "there's no print queue named Nope" });
  });

  it("isn't reachable when Bonjour stays silent (away from home)", async () => {
    const { runner } = statusRunner({ dns: { code: null, stdout: "Lookup CanonMF4800._pdl-datastream._tcp.local.\n", stderr: "", timedOut: true } });

    assert.deepEqual(await printerStatus("CanonMF4800", { run: runner }), { reachable: false, reason: "the printer didn't answer on the network" });
  });

  it("decodes a Bonjour name with spaces", async () => {
    const { runner, calls } = statusRunner({ v: ok("device for X: dnssd://Canon%20MF4800._ipp._tcp.local./?uuid=1\n") });

    await printerStatus("X", { run: runner });

    assert.deepEqual(calls.at(-1)?.args, ["-L", "Canon MF4800", "_ipp._tcp", "local."]);
  });

  it("trusts an enabled queue whose device isn't on Bonjour", async () => {
    const { runner, calls } = statusRunner({ v: ok("device for X: ipp://192.168.1.20/ipp/print\n") });

    assert.equal((await printerStatus("X", { run: runner })).reachable, true);
    assert.ok(!calls.some((c) => c.command === "dns-sd"));
  });
});

describe("printPdf", () => {
  const instant = { sleep: async () => {} };

  it("sends the PDF with lp and waits until the job leaves the queue", async () => {
    let polls = 0;
    const { runner, calls } = fakeRunner(({ command }) => {
      if (command === "lp") return ok("request id is CanonMF4800-42 (1 file(s))\n");
      if (command === "lpstat") return ++polls < 3 ? ok("CanonMF4800-42   mattan   38912   Sun Oct 11 09:00:05 2026\n") : ok("");
      throw new Error(`unexpected command ${command}`);
    });

    const result = await printPdf("/tmp/sheet.pdf", "CanonMF4800", "Dashboard 2026-W41", { run: runner, ...instant });

    assert.deepEqual(result, { ok: true, job: "CanonMF4800-42" });
    assert.deepEqual(calls[0], { command: "lp", args: ["-d", "CanonMF4800", "-o", "media=Letter", "-t", "Dashboard 2026-W41", "/tmp/sheet.pdf"] });
    assert.deepEqual(calls[1], { command: "lpstat", args: ["-W", "not-completed", "-o", "CanonMF4800"] });
  });

  it("isn't fooled by a job with a longer number", async () => {
    let polls = 0;
    const { runner } = fakeRunner(({ command }) => {
      if (command === "lp") return ok("request id is CanonMF4800-4 (1 file(s))\n");
      return ++polls < 2 ? ok("CanonMF4800-42   mattan   1   Sun Oct 11 2026\n") : ok("");
    });

    assert.equal((await printPdf("/tmp/s.pdf", "CanonMF4800", "t", { run: runner, ...instant })).ok, true);
    assert.equal(polls, 1, "job 42 isn't job 4");
  });

  it("reports lp's error", async () => {
    const { runner } = fakeRunner(() => fail("lp: The printer or class does not exist.\n"));

    assert.deepEqual(await printPdf("/tmp/s.pdf", "Nope", "t", { run: runner, ...instant }), {
      ok: false,
      reason: "lp failed: lp: The printer or class does not exist.",
    });
  });

  it("cancels a job that doesn't finish in time, so it can't print twice later", async () => {
    let clock = 0;
    const { runner, calls } = fakeRunner(({ command }) => {
      if (command === "lp") return ok("request id is CanonMF4800-7 (1 file(s))\n");
      if (command === "lpstat") return ok("CanonMF4800-7   mattan   1   Sun Oct 11 2026\n");
      if (command === "cancel") return ok();
      throw new Error(`unexpected command ${command}`);
    });

    const result = await printPdf("/tmp/s.pdf", "CanonMF4800", "t", {
      run: runner,
      sleep: async (ms) => void (clock += ms),
      now: () => clock,
      waitMs: 60_000,
      pollMs: 5_000,
    });

    assert.deepEqual(result, { ok: false, reason: "the print job didn't finish within 1 minute; cancelled it" });
    assert.deepEqual(calls.at(-1), { command: "cancel", args: ["CanonMF4800-7"] });
  });
});
