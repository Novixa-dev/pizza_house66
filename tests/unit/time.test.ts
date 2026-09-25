import { describe, expect, it } from "vitest";
import {
  formatHHmm,
  getTimeZoneOffsetMs,
  getZonedParts,
  isSameZonedDay,
  minutesBetween,
  parseHHmm,
  startOfZonedDay,
  toDateOnly,
  zonedTimeToUtc,
} from "@/lib/time";

// The timezone layer (src/lib/time.ts). Everything about opening hours and
// pickup slots rests on this, and the failure mode it exists to prevent —
// evaluating "16:00" against a UTC server clock — is silent and three hours
// wide, so it gets its own tests rather than only being exercised indirectly.

const ADEN = "Asia/Aden"; // UTC+3, no DST
const LONDON = "Europe/London"; // has DST, for the productization case

describe("getZonedParts", () => {
  it("reads the wall clock an observer in the zone would see", () => {
    const parts = getZonedParts(new Date("2026-01-06T13:00:00Z"), ADEN);
    expect(parts).toMatchObject({ year: 2026, month: 1, day: 6, hour: 16, minute: 0 });
  });

  it("reports weekday as 0=Sunday, matching BusinessHour.dayOfWeek", () => {
    // 2026-01-04 is a Sunday.
    expect(getZonedParts(new Date("2026-01-04T12:00:00Z"), ADEN).weekday).toBe(0);
    expect(getZonedParts(new Date("2026-01-06T12:00:00Z"), ADEN).weekday).toBe(2); // Tuesday
  });

  it("rolls the date over when the zone is ahead of UTC", () => {
    // 22:30Z is 01:30 the next day in Aden.
    const parts = getZonedParts(new Date("2026-01-06T22:30:00Z"), ADEN);
    expect(parts.day).toBe(7);
    expect(parts.hour).toBe(1);
  });
});

describe("getTimeZoneOffsetMs", () => {
  it("is +3h for Aden year-round", () => {
    const winter = getTimeZoneOffsetMs(new Date("2026-01-06T12:00:00Z"), ADEN);
    const summer = getTimeZoneOffsetMs(new Date("2026-07-06T12:00:00Z"), ADEN);
    expect(winter).toBe(3 * 3600_000);
    expect(summer).toBe(3 * 3600_000);
  });

  it("tracks DST where the zone has it", () => {
    expect(getTimeZoneOffsetMs(new Date("2026-01-06T12:00:00Z"), LONDON)).toBe(0);
    expect(getTimeZoneOffsetMs(new Date("2026-07-06T12:00:00Z"), LONDON)).toBe(3600_000);
  });
});

describe("zonedTimeToUtc", () => {
  it("converts a wall-clock reading to the instant it denotes", () => {
    expect(zonedTimeToUtc(2026, 1, 6, 16, 0, ADEN).toISOString()).toBe("2026-01-06T13:00:00.000Z");
  });

  it("round-trips with getZonedParts", () => {
    for (const hour of [0, 6, 12, 16, 23]) {
      const instant = zonedTimeToUtc(2026, 3, 15, hour, 30, ADEN);
      const parts = getZonedParts(instant, ADEN);
      expect({ h: parts.hour, m: parts.minute, d: parts.day }).toEqual({ h: hour, m: 30, d: 15 });
    }
  });

  it("resolves correctly across a DST boundary", () => {
    // London moved to BST on 2026-03-29; 12:00 local that day is 11:00Z.
    expect(zonedTimeToUtc(2026, 3, 29, 12, 0, LONDON).toISOString()).toBe("2026-03-29T11:00:00.000Z");
    // …and 12:00 the day before is 12:00Z.
    expect(zonedTimeToUtc(2026, 3, 28, 12, 0, LONDON).toISOString()).toBe("2026-03-28T12:00:00.000Z");
  });
});

describe("startOfZonedDay", () => {
  it("is local midnight, not UTC midnight", () => {
    // Midnight in Aden is 21:00Z the previous day.
    const start = startOfZonedDay(new Date("2026-01-06T13:00:00Z"), ADEN);
    expect(start.toISOString()).toBe("2026-01-05T21:00:00.000Z");
  });

  it("puts a late-evening order in the same restaurant day", () => {
    // 22:00 local on the 6th must belong to the 6th's takings, not the 7th's.
    const evening = new Date("2026-01-06T19:00:00Z"); // 22:00 Aden
    expect(isSameZonedDay(evening, new Date("2026-01-06T13:00:00Z"), ADEN)).toBe(true);
  });
});

describe("parseHHmm / formatHHmm", () => {
  it("parses valid times", () => {
    expect(parseHHmm("16:00")).toEqual({ hour: 16, minute: 0 });
    expect(parseHHmm("00:30")).toEqual({ hour: 0, minute: 30 });
    expect(parseHHmm(" 9:05 ")).toEqual({ hour: 9, minute: 5 });
  });

  it("rejects malformed input rather than guessing", () => {
    for (const bad of ["", "16", "16:0", "25:00", "16:60", "abc", "16-00"]) {
      expect(() => parseHHmm(bad), bad).toThrow();
    }
  });

  it("formats back with padding", () => {
    expect(formatHHmm(9, 5)).toBe("09:05");
    expect(formatHHmm(16, 0)).toBe("16:00");
  });
});

describe("toDateOnly", () => {
  it("returns the local calendar date as UTC midnight", () => {
    // 22:00 local on the 6th is the 6th, even though it is 19:00Z.
    expect(toDateOnly(new Date("2026-01-06T19:00:00Z"), ADEN).toISOString()).toBe(
      "2026-01-06T00:00:00.000Z"
    );
  });
});

describe("minutesBetween", () => {
  it("counts whole minutes and signs them", () => {
    const from = new Date("2026-01-06T13:00:00Z");
    expect(minutesBetween(from, new Date("2026-01-06T13:25:00Z"))).toBe(25);
    expect(minutesBetween(from, new Date("2026-01-06T12:45:00Z"))).toBe(-15);
  });
});
