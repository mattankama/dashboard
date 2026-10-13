import { describe, expect, it } from "vitest";
import {
  SWIPE,
  armed,
  compareArchived,
  compareItems,
  editPatch,
  formatDay,
  isoDay,
  releaseSpeed,
  springBack,
  swipeOutcome,
} from "../public/lib.js";

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

describe("armed (letting go would act)", () => {
  // For a 400px-wide item.
  it("arms once the item is dragged far enough, either way", () => {
    expect(armed(-SWIPE.distance * 400, 400, false)).toBe(true);
    expect(armed(SWIPE.distance * 400, 400, false)).toBe(true);
    expect(armed(SWIPE.distance * 400 - 1, 400, false)).toBe(false);
  });

  it("stays armed a little way back, so the cue doesn't flicker", () => {
    expect(armed(SWIPE.disarm * 400, 400, true)).toBe(true);
    expect(armed(SWIPE.disarm * 400 - 1, 400, true)).toBe(false);
  });
});

describe("swipeOutcome", () => {
  // Distances are px, speeds px/ms (negative = left).
  it("acts when armed, either way", () => {
    expect(swipeOutcome(-200, 0, true)).toBe("left");
    expect(swipeOutcome(200, 0, true)).toBe("right");
  });

  it("goes back after a slow drag that isn't armed", () => {
    expect(swipeOutcome(-100, 0, false)).toBe("back");
    expect(swipeOutcome(100, 0.1, false)).toBe("back");
  });

  it("acts on a quick flick that's still short", () => {
    expect(swipeOutcome(-SWIPE.flickMin, -SWIPE.flickSpeed, false)).toBe("left");
    expect(swipeOutcome(SWIPE.flickMin, SWIPE.flickSpeed, false)).toBe("right");
  });

  it("ignores a flick that's too short or too slow", () => {
    expect(swipeOutcome(-(SWIPE.flickMin - 1), -2, false)).toBe("back");
    expect(swipeOutcome(-SWIPE.flickMin, -SWIPE.flickSpeed + 0.01, false)).toBe("back");
  });

  it("goes back when the finger is heading back as it lets go, however far it got", () => {
    expect(swipeOutcome(-300, SWIPE.flickSpeed, true)).toBe("back");
    expect(swipeOutcome(300, -SWIPE.flickSpeed, true)).toBe("back");
  });

  it("still acts when the finger drifts back slowly as it lets go", () => {
    expect(swipeOutcome(-300, 0.1, true)).toBe("left");
  });

  it("goes back when nothing moved", () => {
    expect(swipeOutcome(0, 0, false)).toBe("back");
  });
});

describe("springBack (no bounce)", () => {
  const points = (easing: string) => easing.replace(/^linear\(|\)$/g, "").split(",").map(Number);

  it("eases from 0 to 1 without ever passing the end", () => {
    const { easing, duration } = springBack(120, 0);
    const p = points(easing);
    expect(p[0]).toBe(0);
    expect(p.at(-1)).toBe(1);
    for (let i = 1; i < p.length; i++) {
      expect(p[i]).toBeGreaterThanOrEqual(p[i - 1]);
      expect(p[i]).toBeLessThanOrEqual(1);
    }
    expect(duration).toBeGreaterThan(150);
    expect(duration).toBeLessThanOrEqual(500);
  });

  it("starts faster when the finger was already heading back", () => {
    const still = points(springBack(120, 0).easing);
    const heading = points(springBack(120, -1).easing);
    expect(heading[1]).toBeGreaterThan(still[1]);
  });

  it("never overshoots, however fast the finger was heading back", () => {
    const p = points(springBack(40, -10).easing);
    expect(Math.max(...p)).toBeLessThanOrEqual(1);
  });

  it("ignores a finger heading away from rest", () => {
    expect(springBack(120, 1)).toEqual(springBack(120, 0));
  });

  it("takes no time when there's nowhere to go", () => {
    expect(springBack(0.2, 0).duration).toBe(0);
  });
});

describe("releaseSpeed", () => {
  it("measures the last moves before letting go", () => {
    const moves = [
      { x: 0, t: 0 },
      { x: -50, t: 190 }, // older than the window: ignored
      { x: -60, t: 260 },
      { x: -100, t: 300 },
    ];
    expect(releaseSpeed(moves, 300)).toBeCloseTo(-1);
  });

  it("is zero when the finger stopped before letting go", () => {
    const moves = [
      { x: 0, t: 0 },
      { x: -80, t: 40 },
    ];
    expect(releaseSpeed(moves, 40 + SWIPE.stopped + 1)).toBe(0);
  });

  it("is zero with only one move", () => {
    expect(releaseSpeed([{ x: 10, t: 5 }], 10)).toBe(0);
  });
});

describe("compareArchived (same order as the API's archived list)", () => {
  it("puts the most recently archived first", () => {
    const earlier = { ...item("earlier", false, "2026-10-01T00:00:00.000Z"), archivedAt: "2026-10-05T00:00:00.000Z" };
    const later = { ...item("later", true, "2026-10-02T00:00:00.000Z"), archivedAt: "2026-10-09T00:00:00.000Z" };

    expect([earlier, later].sort(compareArchived).map((i) => i.id)).toEqual(["later", "earlier"]);
  });
});
