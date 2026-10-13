import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Item } from "../src/api.ts";
import type { Group } from "../src/group.ts";
import { FIT_LEVELS, TEXT_SCALE, renderSheet } from "../src/render.ts";

function item(id: string, text: string, pinned = false): Item {
  return { id, text, category: null, pinned, createdAt: "", updatedAt: "", archivedAt: null };
}

const GROUPS: Group[] = [
  { heading: "People", items: [item("p", "Call Grandma on Sundays", true), item("a", "Noa's birthday in November")] },
  { heading: "School", items: [item("b", "Ask Ms. Levin about the summer program")] },
];
const LABELS = { range: "Oct 11 – Oct 17, 2026", printed: "Sun Oct 11" };

const render = (groups = GROUPS, fit = FIT_LEVELS[0]) => renderSheet(groups, LABELS, fit);

describe("renderSheet", () => {
  it("has the header and footer from PRINT_LAYOUT.md", () => {
    const html = render();

    assert.match(html, /<h1>Dashboard<\/h1>/);
    assert.ok(html.includes("Oct 11 – Oct 17, 2026"));
    assert.ok(html.includes("Printed Sun Oct 11 · 3 items"));
  });

  it("says '1 item' for one item", () => {
    assert.ok(render([{ heading: null, items: [item("x", "Only one")] }]).includes("Printed Sun Oct 11 · 1 item<"));
  });

  it("keeps the order of groups and of items within them", () => {
    const html = render();
    const order = ["People", "Call Grandma on Sundays", "Noa&#39;s birthday in November", "School", "Ask Ms. Levin"].map((s) =>
      html.indexOf(s),
    );

    assert.ok(order.every((at) => at > 0), "everything is on the sheet");
    assert.deepEqual([...order].sort((a, b) => a - b), order);
  });

  it("marks pinned items with a star and the rest with a bullet", () => {
    const html = render();

    assert.match(html, /<li class="pinned"><span class="mark">★<\/span><span class="text">Call Grandma on Sundays<\/span><\/li>/);
    assert.match(html, /<li><span class="mark">•<\/span><span class="text">Noa&#39;s birthday in November<\/span><\/li>/);
  });

  it("shows text exactly as written, with HTML escaped", () => {
    const html = render([{ heading: "A & B <i>", items: [item("x", `<b>hi</b> & "quoted"\nsecond line`)] }]);

    assert.ok(html.includes("<h2>A &amp; B &lt;i&gt;</h2>"));
    assert.ok(html.includes(`&lt;b&gt;hi&lt;/b&gt; &amp; &quot;quoted&quot;\nsecond line`));
    assert.ok(!html.includes("<b>hi</b>"));
  });

  it("leaves out the heading for the one-list fallback", () => {
    const html = render([{ heading: null, items: [item("x", "a"), item("y", "b")] }]);

    assert.ok(!html.includes("<h2>"));
    assert.equal(html.match(/<li>/g)?.length, 2);
  });

  it("is black on white, US Letter, 0.75in margins, in Charter", () => {
    const html = render();

    assert.match(html, /@page \{ size: Letter; margin: 0\.75in; \}/);
    assert.match(html, /font-family: Charter/);
    assert.ok(!/#(?!000\b|fff\b)[0-9a-f]{3,6}\b/i.test(html), "only black and white");
  });
});

describe("FIT_LEVELS", () => {
  it("tighten spacing before shrinking type, never below 10pt × TEXT_SCALE", () => {
    const [first, second, ...rest] = FIT_LEVELS;

    assert.equal(second.itemPt, first.itemPt, "the second level only tightens spacing");
    assert.ok(second.space < first.space);
    for (const level of rest) assert.ok(level.itemPt < first.itemPt);
    assert.equal(Math.min(...FIT_LEVELS.map((l) => l.itemPt)), 10 * TEXT_SCALE);
  });

  it("feed the sizes into the sheet", () => {
    const html = render(GROUPS, FIT_LEVELS[FIT_LEVELS.length - 1]);
    assert.match(html, /body \{[^}]*font-size: 15pt/);
  });

  it("print every text 1.5 times the original design", () => {
    assert.equal(TEXT_SCALE, 1.5);
    const html = render();
    assert.match(html, /body \{[^}]*font-size: 18pt/, "items: 12pt × 1.5");
    assert.match(html, /h1 \{[^}]*font-size: 30pt/, "title: 20pt × 1.5");
    assert.match(html, /\.range \{ font-size: 16.5pt/, "dates: 11pt × 1.5");
    assert.match(html, /h2 \{[^}]*font-size: 20.25pt/, "headings: 13.5pt × 1.5");
    assert.match(html, /footer \{[^}]*font-size: 13.5pt/, "footer: 9pt × 1.5");
  });
});
