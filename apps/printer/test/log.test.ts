import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileLogger } from "../src/log.ts";

describe("fileLogger", () => {
  it("appends timestamped, levelled lines, creating the folder", () => {
    const file = path.join(mkdtempSync(path.join(tmpdir(), "dash-log-")), "nested", "dashboard.log");
    const log = fileLogger(file, { echo: false, now: () => new Date("2026-10-11T16:00:00.000Z") });

    log.info("week 2026-W41: printed");
    log.warn("sheet needs 2 pages");
    log.error("email failed: timeout");

    assert.equal(
      readFileSync(file, "utf8"),
      [
        "2026-10-11T16:00:00.000Z INFO  week 2026-W41: printed",
        "2026-10-11T16:00:00.000Z WARN  sheet needs 2 pages",
        "2026-10-11T16:00:00.000Z ERROR email failed: timeout",
        "",
      ].join("\n"),
    );
  });
});
