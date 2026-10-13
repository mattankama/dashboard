import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { describe, it } from "node:test";
import type { Item } from "../src/api.ts";
import { makePdf, pageCount } from "../src/pdf.ts";
import { run } from "../src/run.ts";
import { memoryLogger } from "./fakes.ts";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const noChrome = !existsSync(CHROME) && "Google Chrome isn't installed here";
const LABELS = { range: "Oct 11 – Oct 17, 2026", printed: "Sun Oct 11" };

function items(count: number, words = 8): Item[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `i${i}`,
    text: `Item ${i + 1}: ${"something worth keeping in mind ".repeat(words).trim()}`,
    category: null,
    pinned: i < 2,
    createdAt: "",
    updatedAt: "",
    archivedAt: null,
  }));
}

describe("pageCount", () => {
  it("reads the page tree's count", () => {
    const pdf = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>\nendobj\n", "latin1");
    assert.equal(pageCount(pdf), 2);
  });

  it("returns 0 for something that isn't a PDF page tree", () => {
    assert.equal(pageCount(Buffer.from("not a pdf")), 0);
  });
});

describe("makePdf with the real Chrome", { skip: noChrome }, () => {
  it("fits a normal week on one page at the roomiest size", async () => {
    const result = await makePdf([{ heading: "All", items: items(8, 3) }], LABELS, { chromePath: CHROME, run, log: memoryLogger() });

    assert.equal(result.pages, 1);
    assert.equal(result.level, 0);
    assert.equal(result.pdf.subarray(0, 5).toString("latin1"), "%PDF-");
  });

  // Measured with Charter on this Mac, with text at 1.5× (TEXT_SCALE): one-line items
  // fit about 16 to a page at the roomiest level and about 24 at 15pt.
  it("tightens spacing first to keep a longer list on one page", async () => {
    const result = await makePdf([{ heading: "All", items: items(18, 1) }], LABELS, { chromePath: CHROME, run, log: memoryLogger() });

    assert.equal(result.pages, 1);
    assert.equal(result.level, 1, "spacing only, type unchanged");
  });

  it("then shrinks the type to stay on one page", async () => {
    const result = await makePdf([{ heading: "All", items: items(22, 1) }], LABELS, { chromePath: CHROME, run, log: memoryLogger() });

    assert.equal(result.pages, 1);
    assert.ok(result.level >= 2, "smaller type");
  });

  it("uses the roomiest two-page layout when one page is impossible", async () => {
    const result = await makePdf([{ heading: "All", items: items(30, 1) }], LABELS, { chromePath: CHROME, run, log: memoryLogger() });

    assert.equal(result.pages, 2);
    assert.equal(result.level, 0);
  });

  it("warns when even the smallest size needs more than two pages", async () => {
    const log = memoryLogger();
    const result = await makePdf([{ heading: "All", items: items(150) }], LABELS, { chromePath: CHROME, run, log });

    assert.ok(result.pages > 2);
    assert.ok(log.lines.some((line) => /^WARN the sheet needs \d+ pages/.test(line)));
  });

  it("reports a missing Chrome clearly", async () => {
    await assert.rejects(
      makePdf([{ heading: null, items: items(1) }], LABELS, { chromePath: "/nope/Chrome", run, log: memoryLogger() }),
      /Chrome failed/,
    );
  });
});
