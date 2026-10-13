# Weekly sheet layout

The sheet should feel calm and easy to read, like a list on the fridge, not a report.

## Page

- US Letter, portrait, about 0.75in margins.
- **Black and white only.** The MF4800 is a mono laser printer, so use no color and no gray fills that print muddy.
- One page is the target and two pages the maximum. If items overflow, shrink spacing first, then font size (no smaller than 15pt).

## Content, top to bottom

1. **Header:** "Dashboard", plus the week's date range (e.g. "Oct 11 – Oct 17, 2026").
2. **Groups:** each group has a short heading from Claude (or the category in fallback mode), followed by its items as a simple bulleted list.
   - Pinned items come first within their group, marked with a small ★.
   - Item text appears exactly as written.
   - Order groups from largest to smallest.
3. **Footer:** small text with the print date and item count (e.g. "Printed Sun Oct 11 · 14 items").

## Not on the sheet

No AI commentary, summaries, "focus" lines, staleness markers, checkboxes or QR codes.

## Typography

- One readable serif or system font, with item text around 18pt and headings around 20pt in semibold. **Every size on the sheet is 1.5 times the original design** (items were 12pt, headings 13.5pt, the title 20pt; Mattan, 2026-10-12). `TEXT_SCALE` in `apps/printer/src/render.ts` sets it.
- Use a thin rule under each group heading. Avoid heavy borders and boxes.
