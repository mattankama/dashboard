// From the week's items to the finished PDF: group, label, render, print to PDF.
import type Anthropic from "@anthropic-ai/sdk";
import type { Item } from "./api.ts";
import { groupItems } from "./group.ts";
import type { Logger } from "./log.ts";
import { makePdf } from "./pdf.ts";
import type { Runner } from "./run.ts";
import { printedLabel, weekRange } from "./schedule.ts";

export interface BuiltSheet {
  pdf: Buffer;
  pages: number;
  grouping: "claude" | "fallback";
}

export async function buildSheet(
  items: Item[],
  { target, now, client, chromePath, run, log }: { target: Date; now: Date; client: Anthropic | null; chromePath: string; run: Runner; log: Logger },
): Promise<BuiltSheet> {
  const grouping = await groupItems(items, { client, log });
  const labels = { range: weekRange(target), printed: printedLabel(now) };
  const { pdf, pages } = await makePdf(grouping.groups, labels, { chromePath, run, log });
  return { pdf, pages, grouping: grouping.source };
}
