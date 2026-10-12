import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fileDate, isoWeek, mostRecentTarget, printedLabel, weekRange } from "../src/schedule.ts";

// The test script pins TZ=America/Los_Angeles; these are local wall-clock times there.
const SUNDAY_9 = { weekday: 0, hour: 9, minute: 0 };
const at = (iso: string) => new Date(iso); // ISO strings with offsets, for clarity

describe("mostRecentTarget", () => {
  it("is today at 09:00 once 09:00 Sunday has passed", () => {
    const target = mostRecentTarget(at("2026-10-11T09:00:00-07:00"), SUNDAY_9);
    assert.equal(target.toISOString(), "2026-10-11T16:00:00.000Z");
  });

  it("is last Sunday just before 09:00 Sunday", () => {
    const target = mostRecentTarget(at("2026-10-11T08:59:59-07:00"), SUNDAY_9);
    assert.equal(target.toISOString(), "2026-10-04T16:00:00.000Z");
  });

  it("is yesterday when the Mac wakes up on Monday (catch-up)", () => {
    const target = mostRecentTarget(at("2026-10-12T07:30:00-07:00"), SUNDAY_9);
    assert.equal(target.toISOString(), "2026-10-11T16:00:00.000Z");
  });

  it("is still last Sunday late on Saturday", () => {
    const target = mostRecentTarget(at("2026-10-17T23:59:00-07:00"), SUNDAY_9);
    assert.equal(target.toISOString(), "2026-10-11T16:00:00.000Z");
  });

  it("keeps 09:00 local on the Sunday daylight saving ends", () => {
    // 2026-11-01: clocks fall back at 02:00, so 09:00 is PST (UTC-8).
    const target = mostRecentTarget(at("2026-11-01T10:00:00-08:00"), SUNDAY_9);
    assert.equal(target.toISOString(), "2026-11-01T17:00:00.000Z");
  });

  it("keeps 09:00 local when stepping back across the start of daylight saving", () => {
    // 2026-03-08: clocks spring forward. At 08:00 PDT the target is the previous Sunday, 09:00 PST.
    const target = mostRecentTarget(at("2026-03-08T08:00:00-07:00"), SUNDAY_9);
    assert.equal(target.toISOString(), "2026-03-01T17:00:00.000Z");
  });

  it("follows another day and time", () => {
    const target = mostRecentTarget(at("2026-10-14T12:00:00-07:00"), { weekday: 3, hour: 7, minute: 30 });
    assert.equal(target.toISOString(), "2026-10-14T14:30:00.000Z");
  });
});

describe("isoWeek", () => {
  it("names the ISO week of a local date", () => {
    assert.equal(isoWeek(at("2026-10-11T09:00:00-07:00")), "2026-W41");
  });

  it("gets the weeks around the end of the year right", () => {
    assert.equal(isoWeek(at("2025-12-28T09:00:00-08:00")), "2025-W52");
    assert.equal(isoWeek(at("2026-01-04T09:00:00-08:00")), "2026-W01");
    assert.equal(isoWeek(at("2026-12-27T09:00:00-08:00")), "2026-W52");
    // 2026 starts on a Thursday, so it has 53 ISO weeks; Sunday 2027-01-03 ends the last one.
    assert.equal(isoWeek(at("2027-01-03T09:00:00-08:00")), "2026-W53");
  });

  it("uses the local date, not UTC (Sunday 21:00 here is already Monday in UTC)", () => {
    assert.equal(isoWeek(at("2026-10-11T21:00:00-07:00")), "2026-W41");
  });
});

describe("labels", () => {
  it("shows the week as Sunday to Saturday", () => {
    assert.equal(weekRange(at("2026-10-11T09:00:00-07:00")), "Oct 11 – Oct 17, 2026");
    assert.equal(weekRange(at("2026-11-29T09:00:00-08:00")), "Nov 29 – Dec 5, 2026");
  });

  it("names both years when the week crosses New Year", () => {
    assert.equal(weekRange(at("2026-12-27T09:00:00-08:00")), "Dec 27, 2026 – Jan 2, 2027");
  });

  it("shows the print date like the footer in PRINT_LAYOUT.md", () => {
    assert.equal(printedLabel(at("2026-10-11T09:02:00-07:00")), "Sun Oct 11");
  });

  it("gives a local YYYY-MM-DD for file names", () => {
    assert.equal(fileDate(at("2026-10-11T21:00:00-07:00")), "2026-10-11");
  });
});
