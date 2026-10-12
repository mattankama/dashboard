import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseFlags } from "../src/flags.ts";

describe("parseFlags", () => {
  it("defaults to a real run", () => {
    assert.deepEqual(parseFlags([]), { ok: true, flags: { dryRun: false, force: false, sample: false, help: false } });
  });

  it("reads --dry-run, --force and --help", () => {
    assert.deepEqual(parseFlags(["--dry-run", "--force"]), {
      ok: true,
      flags: { dryRun: true, force: true, sample: false, help: false },
    });
    assert.equal(parseFlags(["--help"]).ok && parseFlags(["--help"]).ok, true);
  });

  it("--sample implies --dry-run, so sample items can never be printed", () => {
    assert.deepEqual(parseFlags(["--sample"]), { ok: true, flags: { dryRun: true, force: false, sample: true, help: false } });
  });

  it("rejects unknown flags", () => {
    const result = parseFlags(["--print-now"]);
    assert.equal(result.ok, false);
  });
});
