import { describe, expect, it } from "vitest";
import { compareArchived, compareItems, editPatch, formatDay, isoDay, swipeOutcome } from "../public/lib.js";

function item(id: string, pinned: boolean, createdAt: string) {
  return { id, text: id, category: null, pinned, createdAt, updatedAt: createdAt, archivedAt: null };
}

describe("compareItems (same order as the API's active list)", () => {
  it("puts pinned items before unpinned ones", () => {
    const older = item("pinned", true, "2026-10-01T00:00:00.000Z");
    const newer = item("plain", false, "2026-10-11T00:00:00.000Z");

    expect([newer, older].sort(compareItems).map((i) => i.id)).toEqual(["pinned", "plain"]);
  });

  it("puts newer items first when both have the same pin state", () => {
    const a = item("old", false, "2026-10-01T00:00:00.000Z");
    const b = item("new", false, "2026-10-11T00:00:00.000Z");

    expect([a, b].sort(compareItems).map((i) => i.id)).toEqual(["new", "old"]);
  });
});

describe("formatDay", () => {
  it("formats a date like the top of a planner page", () => {
    expect(formatDay(new Date(2026, 9, 11), "en-US")).toBe("Sunday, October 11");
  });
});

describe("isoDay", () => {
  it("gives the local calendar date as YYYY-MM-DD", () => {
    expect(isoDay(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
  });
});

describe("editPatch", () => {
  const original = item("a", false, "2026-10-11T00:00:00.000Z");
  original.text = "Call Grandma";

  it("is null when nothing changed", () => {
    expect(editPatch(original, "Call Grandma")).toBeNull();
  });

  it("ignores changes that are only surrounding whitespace", () => {
    expect(editPatch(original, "  Call Grandma \n")).toBeNull();
  });

  it("sends the text when it changed", () => {
    expect(editPatch(original, "Call Grandma on Sundays")).toEqual({ text: "Call Grandma on Sundays" });
  });

  it("sends a pin change on its own", () => {
    expect(editPatch(original, "Call Grandma", { pinned: true })).toEqual({ pinned: true });
  });

  it("sends a text change together with archiving", () => {
    expect(editPatch(original, "Call Grandma soon", { archived: true })).toEqual({
      text: "Call Grandma soon",
      archived: true,
    });
  });
});

describe("swipeOutcome", () => {
  it("acts left once the item is dragged halfway to the left", () => {
    expect(swipeOutcome(-200, 400)).toBe("left");
  });

  it("acts right once the item is dragged halfway to the right", () => {
    expect(swipeOutcome(200, 400)).toBe("right");
  });

  it("springs back before halfway either way", () => {
    expect(swipeOutcome(-199, 400)).toBe("back");
    expect(swipeOutcome(199, 400)).toBe("back");
  });
});

describe("compareArchived (same order as the API's archived list)", () => {
  it("puts the most recently archived first", () => {
    const earlier = { ...item("earlier", false, "2026-10-01T00:00:00.000Z"), archivedAt: "2026-10-05T00:00:00.000Z" };
    const later = { ...item("later", true, "2026-10-02T00:00:00.000Z"), archivedAt: "2026-10-09T00:00:00.000Z" };

    expect([earlier, later].sort(compareArchived).map((i) => i.id)).toEqual(["later", "earlier"]);
  });
});
