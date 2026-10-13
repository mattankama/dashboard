// The sheet as a PDF, printed by the installed Chrome (no PDF library needed).
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Group } from "./group.ts";
import type { Logger } from "./log.ts";
import { FIT_LEVELS, renderSheet, type SheetLabels } from "./render.ts";
import type { Runner } from "./run.ts";

/** The page count from the PDF's page tree (Chrome writes it uncompressed). */
export function pageCount(pdf: Buffer): number {
  const text = pdf.toString("latin1");
  let pages = 0;
  for (const match of text.matchAll(/<<[^]*?>>/g)) {
    if (!/\/Type\s*\/Pages\b/.test(match[0])) continue;
    const count = /\/Count\s+(\d+)/.exec(match[0]);
    if (count) pages = Math.max(pages, Number(count[1]));
  }
  return pages;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** True once the PDF is whole: it ends with %%EOF and stopped growing. */
async function finished(file: string, previousSize: number): Promise<{ done: boolean; size: number }> {
  const info = await stat(file).catch(() => null);
  if (!info || info.size === 0) return { done: false, size: 0 };
  if (info.size !== previousSize) return { done: false, size: info.size };
  const tail = (await readFile(file)).subarray(-32).toString("latin1");
  return { done: tail.includes("%%EOF"), size: info.size };
}

async function printToPdf(html: string, chromePath: string, run: Runner): Promise<Buffer> {
  // A throwaway folder and Chrome profile, so this never touches Mattan's own Chrome.
  const work = await mkdtemp(path.join(tmpdir(), "dashboard-sheet-"));
  try {
    const htmlFile = path.join(work, "sheet.html");
    const pdfFile = path.join(work, "sheet.pdf");
    await writeFile(htmlFile, html);
    // With its own profile, Chrome 154 writes the PDF but doesn't exit, so watch
    // for the finished file and close Chrome then.
    const stop = new AbortController();
    let exited = false;
    const chrome = run(
      chromePath,
      [
        "--headless=new",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-extensions",
        `--user-data-dir=${path.join(work, "profile")}`,
        "--no-pdf-header-footer",
        `--print-to-pdf=${pdfFile}`,
        pathToFileURL(htmlFile).href,
      ],
      { timeoutMs: 60_000, signal: stop.signal },
    ).finally(() => (exited = true));

    let size = 0;
    let done = false;
    while (!exited && !done) {
      await sleep(200);
      ({ done, size } = await finished(pdfFile, size));
    }
    stop.abort();
    const result = await chrome;

    const pdf = done || result.code === 0 ? await readFile(pdfFile).catch(() => null) : null;
    if (pdf === null || pageCount(pdf) === 0) {
      const why = result.timedOut ? "timed out" : `exit ${result.code}: ${result.stderr.trim().split("\n").at(-1) ?? ""}`;
      throw new Error(`Chrome failed to make the PDF (${why})`);
    }
    return pdf;
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

export interface Sheet {
  pdf: Buffer;
  pages: number;
  level: number; // index into FIT_LEVELS
}

/**
 * Prints the sheet at each fit level until it fits one page. Otherwise the first
 * level that fits two; otherwise the smallest, with a warning (it still prints).
 */
export async function makePdf(
  groups: Group[],
  labels: SheetLabels,
  { chromePath, run, log }: { chromePath: string; run: Runner; log: Logger },
): Promise<Sheet> {
  let twoPages: Sheet | null = null;
  let last: Sheet | null = null;
  for (const [level, fit] of FIT_LEVELS.entries()) {
    const pdf = await printToPdf(renderSheet(groups, labels, fit), chromePath, run);
    const sheet = { pdf, pages: pageCount(pdf), level };
    if (sheet.pages === 1) return sheet;
    if (sheet.pages === 2 && twoPages === null) twoPages = sheet;
    last = sheet;
  }
  if (twoPages) return twoPages;
  log.warn(`the sheet needs ${last!.pages} pages even at ${FIT_LEVELS.at(-1)!.itemPt}pt; printing it anyway`);
  return last!;
}
