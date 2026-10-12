import { describe, expect, it } from "vitest";
import { compareItems, formatDay, isoDay } from "../public/lib.js";

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
