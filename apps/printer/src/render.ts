// The printed sheet, as HTML for Chrome to print (docs/PRINT_LAYOUT.md).
// Black and white only: the Canon MF4800 is a mono laser printer.
import type { Group } from "./group.ts";

export interface Fit {
  itemPt: number; // item text size
  headingPt: number; // group heading size
  space: number; // multiplies every vertical gap
}

/** Every text size on the sheet, 1.5 times the original design (Mattan, 2026-10-12). */
export const TEXT_SCALE = 1.5;

const pt = (size: number) => `${size * TEXT_SCALE}pt`;

/** Tried in order until the sheet fits: spacing tightens first, then type shrinks (never below 10pt × TEXT_SCALE). */
export const FIT_LEVELS: Fit[] = [
  { itemPt: 12, headingPt: 13.5, space: 1 },
  { itemPt: 12, headingPt: 13.5, space: 0.6 },
  { itemPt: 11, headingPt: 12.5, space: 0.5 },
  { itemPt: 10.5, headingPt: 12, space: 0.4 },
  { itemPt: 10, headingPt: 11.5, space: 0.35 },
].map((fit) => ({ ...fit, itemPt: fit.itemPt * TEXT_SCALE, headingPt: fit.headingPt * TEXT_SCALE }));

export interface SheetLabels {
  range: string; // "Oct 11 – Oct 17, 2026"
  printed: string; // "Sun Oct 11"
}

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Item text is the person's own words: escaped, never interpreted as HTML. */
function escape(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

function renderGroup(group: Group): string {
  const items = group.items
    .map((item) =>
      item.pinned
        ? `<li class="pinned"><span class="mark">★</span><span class="text">${escape(item.text)}</span></li>`
        : `<li><span class="mark">•</span><span class="text">${escape(item.text)}</span></li>`,
    )
    .join("\n");
  const heading = group.heading === null ? "" : `<h2>${escape(group.heading)}</h2>\n`;
  return `<section>\n${heading}<ul>\n${items}\n</ul>\n</section>`;
}

export function renderSheet(groups: Group[], labels: SheetLabels, fit: Fit): string {
  const count = groups.reduce((sum, group) => sum + group.items.length, 0);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Dashboard, ${escape(labels.range)}</title>
<style>
@page { size: Letter; margin: 0.75in; }
* { box-sizing: border-box; }
html { color: #000; background: #fff; }
body {
  margin: 0;
  font-family: Charter, "Bitstream Charter", Georgia, serif;
  font-size: ${fit.itemPt}pt;
  line-height: 1.35;
}
header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: ${(1.2 * fit.space).toFixed(2)}em;
}
h1 { margin: 0; font-size: ${pt(20)}; font-weight: 700; }
.range { font-size: ${pt(11)}; }
section { margin-top: ${(1.3 * fit.space).toFixed(2)}em; }
h2 {
  margin: 0 0 ${(0.35 * fit.space).toFixed(2)}em;
  padding-bottom: 2pt;
  border-bottom: 0.5pt solid #000;
  font-size: ${fit.headingPt}pt;
  font-weight: 600;
  break-after: avoid;
}
ul { margin: 0; padding: 0; list-style: none; }
li {
  display: grid;
  grid-template-columns: 1.1em 1fr;
  padding: ${(0.22 * fit.space).toFixed(2)}em 0;
  break-inside: avoid;
}
.pinned .mark { font-size: 0.85em; line-height: 1.6; }
.text { white-space: pre-wrap; overflow-wrap: anywhere; }
footer { margin-top: ${(1.8 * fit.space).toFixed(2)}em; font-size: ${pt(9)}; }
</style>
</head>
<body>
<header><h1>Dashboard</h1><div class="range">${escape(labels.range)}</div></header>
<main>
${groups.map(renderGroup).join("\n")}
</main>
<footer>Printed ${escape(labels.printed)} · ${count} ${count === 1 ? "item" : "items"}</footer>
</body>
</html>
`;
}
