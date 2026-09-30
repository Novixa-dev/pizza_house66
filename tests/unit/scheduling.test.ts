import { describe, expect, it } from "vitest";
import {
  computeKitchenReleaseAt,
  earliestPossiblePickup,
  generatePickupSlots,
  isOpenNow,
  isReadyForKitchenRelease,
  isWithinBusinessHours,
  nextValidPickupSlot,
  slotStartFor,
  snapUpToSlot,
  validatePickupTime,
  type BusinessHourRule,
  type SchedulingConfig,
} from "@/lib/scheduling";

// The restaurant trades 16:00–00:00 in Asia/Aden (UTC+3, no DST). Every
// instant below is written in UTC so the tests stay honest about the
// distinction the production bug lived in: the *server* clock is UTC, the
// *business hours* are local. 16:00 Aden === 13:00Z.
const TZ = "Asia/Aden";

const dailyHours: BusinessHourRule[] = Array.from({ length: 7 }, (_, dayOfWeek) => ({
  dayOfWeek,
  opensAt: "16:00",
  closesAt: "00:00",
  closed: false,
}));

const config: SchedulingConfig = {
  timeZone: TZ,
  hours: dailyHours,
  overrides: [],
  slotIntervalMinutes: 15,
  maxScheduleDaysAhead: 3,
};

/** 2026-01-06 is a Tuesday. */
const aden = (hhmm: string, day = 6) => new Date(`2026-01-0${day}T${hhmm}:00+03:00`);

describe("computeKitchenReleaseAt", () => {
  it("matches the PRD worked example: pickup 19:00, prep 25min → release 18:35", () => {
    const release = computeKitchenReleaseAt(aden("19:00"), 25);
    expect(release.toISOString()).toBe(aden("18:35").toISOString());
  });

  it("matches PROJECT_ORIGIN §4: pickup 20:00, prep 15min → release 19:45", () => {
    const release = computeKitchenReleaseAt(aden("20:00"), 15);
    expect(release.toISOString()).toBe(aden("19:45").toISOString());
  });

  it("does not release a future order early", () => {
    const release = computeKitchenReleaseAt(aden("19:00"), 25);
    expect(isReadyForKitchenRelease(release, aden("16:00"))).toBe(false);
    expect(isReadyForKitchenRelease(release, aden("18:34"))).toBe(false);
    expect(isReadyForKitchenRelease(release, aden("18:35"))).toBe(true);
  });
});

describe("isWithinBusinessHours", () => {
  it("is open during the evening shift", () => {
    expect(isWithinBusinessHours(aden("18:00"), dailyHours, [], TZ)).toBe(true);
  });

  it("is closed before opening", () => {
    expect(isWithinBusinessHours(aden("15:59"), dailyHours, [], TZ)).toBe(false);
  });

  it("treats a closing time past midnight as still open into the next day", () => {
    expect(isWithinBusinessHours(aden("23:30"), dailyHours, [], TZ)).toBe(true);
    // 00:30 the next calendar day is past the 00:00 close.
    expect(isWithinBusinessHours(new Date("2026-01-07T00:30:00+03:00"), dailyHours, [], TZ)).toBe(
      false
    );
  });

  it("uses the restaurant's timezone, not the server's", () => {
    // 13:00Z is 16:00 in Aden — open. A naive implementation using the
    // server's UTC clock would call this closed.
    expect(isWithinBusinessHours(new Date("2026-01-06T13:00:00Z"), dailyHours, [], TZ)).toBe(true);
    // 16:00Z is 19:00 in Aden — also open, but 16:00 by the server clock.
    expect(isWithinBusinessHours(new Date("2026-01-06T16:00:00Z"), dailyHours, [], TZ)).toBe(true);
    // 08:00Z is 11:00 in Aden — closed.
    expect(isWithinBusinessHours(new Date("2026-01-06T08:00:00Z"), dailyHours, [], TZ)).toBe(false);
  });

  it("respects a schedule override that closes an otherwise-open day", () => {
    const overrides = [{ date: aden("12:00"), closed: true }];
    expect(isWithinBusinessHours(aden("18:00"), dailyHours, overrides, TZ)).toBe(false);
    // The next day is unaffected.
    expect(isWithinBusinessHours(aden("18:00", 7), dailyHours, overrides, TZ)).toBe(true);
  });

  it("respects an override with different hours", () => {
    const overrides = [{ date: aden("12:00"), closed: false, opensAt: "20:00", closesAt: "23:00" }];
    expect(isWithinBusinessHours(aden("18:00"), dailyHours, overrides, TZ)).toBe(false);
    expect(isWithinBusinessHours(aden("21:00"), dailyHours, overrides, TZ)).toBe(true);
  });

  it("reports a weekly closed day as closed", () => {
    const withClosedTuesday = dailyHours.map((hour) =>
      hour.dayOfWeek === 2 ? { ...hour, closed: true } : hour
    );
    expect(isOpenNow(aden("18:00"), withClosedTuesday, [], TZ)).toBe(false);
  });
});

describe("snapUpToSlot / slotStartFor", () => {
  it("rounds up to the next slot boundary", () => {
    expect(snapUpToSlot(aden("18:01"), 15, TZ).toISOString()).toBe(aden("18:15").toISOString());
    expect(snapUpToSlot(aden("18:15"), 15, TZ).toISOString()).toBe(aden("18:15").toISOString());
  });

  it("floors to the containing slot for capacity accounting", () => {
    // 19:07 and 19:00 must land in the same bucket, or capacity means nothing.
    expect(slotStartFor(aden("19:07"), 15, TZ).toISOString()).toBe(aden("19:00").toISOString());
    expect(slotStartFor(aden("19:00"), 15, TZ).toISOString()).toBe(aden("19:00").toISOString());
    expect(slotStartFor(aden("19:14"), 15, TZ).toISOString()).toBe(aden("19:00").toISOString());
    expect(slotStartFor(aden("19:15"), 15, TZ).toISOString()).toBe(aden("19:15").toISOString());
  });
});

describe("validatePickupTime", () => {
  const now = aden("16:00");

  const validate = (requested: Date, overrides: Partial<Parameters<typeof validatePickupTime>[0]> = {}) =>
    validatePickupTime({
      now,
      requested,
      prepMinutes: 20,
      config,
      onlineOrderingPaused: false,
      ...overrides,
    });

  it("accepts a time far enough ahead and inside opening hours", () => {
    expect(validate(aden("20:00")).valid).toBe(true);
  });

  it("rejects a time before preparation could finish", () => {
    const result = validate(aden("16:10"));
    expect(result.valid).toBe(false);
    expect(result.reasonCode).toBe("TOO_SOON");
    expect(result.earliestPossible.toISOString()).toBe(aden("16:20").toISOString());
  });

  it("rejects a time in the past", () => {
    expect(validate(aden("15:00")).reasonCode).toBe("IN_PAST");
  });

  it("rejects any time while online ordering is paused", () => {
    expect(validate(aden("20:00"), { onlineOrderingPaused: true }).reasonCode).toBe("PAUSED");
  });

  it("rejects a time outside opening hours", () => {
    expect(validate(new Date("2026-01-07T10:00:00+03:00")).reasonCode).toBe("CLOSED");
  });

  it("rejects a time beyond the booking horizon", () => {
    expect(validate(new Date("2026-01-20T19:00:00+03:00")).reasonCode).toBe("TOO_FAR");
  });

  it("rejects an arbitrary timestamp that is not on a slot boundary", () => {
    // The whole point of offering a slot list: a hand-crafted 19:07 must not
    // be accepted, or capacity counting drifts (docs/PRD.md §12.3).
    const result = validate(aden("19:07"));
    expect(result.valid).toBe(false);
    expect(result.reasonCode).toBe("NOT_A_SLOT");
  });
});

describe("generatePickupSlots", () => {
  it("starts at the first slot boundary at or after preparation finishes", () => {
    // Ordering at 16:00 with 20 minutes of prep means the food is ready at
    // 16:20 — but slots are quarter-hourly, so the first bookable one is
    // 16:30. Offering 16:20 would promise a time the slot grid can't account
    // for in its capacity counting.
    const from = earliestPossiblePickup(aden("16:00"), 20);
    const [first] = generatePickupSlots(from, config);
    expect(first.toISOString()).toBe(aden("16:30").toISOString());
  });

  it("uses a slot exactly on the boundary when prep lands on one", () => {
    const from = earliestPossiblePickup(aden("16:00"), 15);
    const [first] = generatePickupSlots(from, config);
    expect(first.toISOString()).toBe(aden("16:15").toISOString());
  });

  it("skips forward to opening time when the restaurant is shut", () => {
    const slot = nextValidPickupSlot(new Date("2026-01-06T10:00:00+03:00"), config);
    expect(slot?.toISOString()).toBe(aden("16:00").toISOString());
  });

  it("returns slots in ascending order with no duplicates", () => {
    const slots = generatePickupSlots(aden("16:00"), config);
    const times = slots.map((slot) => slot.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(new Set(times).size).toBe(times.length);
  });

  it("never offers a slot outside opening hours", () => {
    const slots = generatePickupSlots(aden("16:00"), config);
    expect(slots.length).toBeGreaterThan(0);
    for (const slot of slots) {
      expect(isWithinBusinessHours(slot, dailyHours, [], TZ)).toBe(true);
    }
  });

  it("stops at the booking horizon", () => {
    const slots = generatePickupSlots(aden("16:00"), config);
    const horizon = aden("16:00").getTime() + config.maxScheduleDaysAhead * 86_400_000;
    for (const slot of slots) {
      expect(slot.getTime()).toBeLessThanOrEqual(horizon);
    }
  });

  it("returns nothing when every day is closed", () => {
    const closed = { ...config, hours: dailyHours.map((hour) => ({ ...hour, closed: true })) };
    expect(generatePickupSlots(aden("16:00"), closed)).toEqual([]);
    expect(nextValidPickupSlot(aden("16:00"), closed)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Two services a day
//
// The real Pizza House 66 opens 08:00–12:00 and again 16:00–23:30, and is shut
// in between. Friday has no morning service. Until the schema allowed a day to
// hold more than one window, the seeded hours said 16:00–00:00 every day, which
// sold pickups at 14:00 into a locked kitchen and refused every morning order.
// These cases exist so that gap can never quietly close again.

const realHours: BusinessHourRule[] = Array.from({ length: 7 }, (_, dayOfWeek) =>
  dayOfWeek === 5
    ? [{ dayOfWeek, opensAt: "16:00", closesAt: "23:30", closed: false }]
    : [
        { dayOfWeek, opensAt: "08:00", closesAt: "12:00", closed: false },
        { dayOfWeek, opensAt: "16:00", closesAt: "23:30", closed: false },
      ]
).flat();

const realConfig: SchedulingConfig = { ...config, hours: realHours };

describe("two services a day", () => {
  it("is open in the morning service", () => {
    expect(isWithinBusinessHours(aden("08:00"), realHours, [], TZ)).toBe(true);
    expect(isWithinBusinessHours(aden("11:59"), realHours, [], TZ)).toBe(true);
  });

  it("is shut in the gap between the two services", () => {
    expect(isWithinBusinessHours(aden("12:00"), realHours, [], TZ)).toBe(false);
    expect(isWithinBusinessHours(aden("14:00"), realHours, [], TZ)).toBe(false);
    expect(isWithinBusinessHours(aden("15:59"), realHours, [], TZ)).toBe(false);
  });

  it("is open in the evening service", () => {
    expect(isWithinBusinessHours(aden("16:00"), realHours, [], TZ)).toBe(true);
    expect(isWithinBusinessHours(aden("23:29"), realHours, [], TZ)).toBe(true);
    expect(isWithinBusinessHours(aden("23:30"), realHours, [], TZ)).toBe(false);
  });

  it("has no morning service on Friday", () => {
    // 2026-01-09 is a Friday.
    expect(isWithinBusinessHours(aden("09:00", 9), realHours, [], TZ)).toBe(false);
    expect(isWithinBusinessHours(aden("17:00", 9), realHours, [], TZ)).toBe(true);
  });

  it("offers no pickup slot inside the gap", () => {
    const slots = generatePickupSlots(aden("08:00"), realConfig);
    expect(slots.length).toBeGreaterThan(0);
    for (const slot of slots) {
      expect(isWithinBusinessHours(slot, realHours, [], TZ)).toBe(true);
    }
    const midday = slots.filter((slot) => {
      const hour = Number(
        new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }).format(slot)
      );
      return hour >= 12 && hour < 16;
    });
    expect(midday).toEqual([]);
  });

  it("jumps an order placed during the gap to the evening service", () => {
    const slot = nextValidPickupSlot(aden("13:00"), realConfig);
    expect(slot).not.toBeNull();
    expect(isWithinBusinessHours(slot!, realHours, [], TZ)).toBe(true);
    expect(slot!.toISOString()).toBe(aden("16:00").toISOString());
  });

  it("offers a morning slot to someone ordering at breakfast", () => {
    // nextValidPickupSlot does not add preparation time — the caller has
    // already done that — so 08:05 snaps up to the next boundary.
    const slot = nextValidPickupSlot(aden("08:05"), realConfig);
    expect(slot).not.toBeNull();
    expect(slot!.toISOString()).toBe(aden("08:15").toISOString());
  });

  it("reaches Saturday morning for an order placed after Friday's close", () => {
    // 2026-01-09 is a Friday; the kitchen shuts at 23:30 and reopens 08:00.
    const slot = nextValidPickupSlot(new Date("2026-01-09T23:30:00+03:00"), realConfig);
    expect(slot).not.toBeNull();
    expect(slot!.toISOString()).toBe(new Date("2026-01-10T08:00:00+03:00").toISOString());
  });

  it("never offers a slot the validator would then reject", () => {
    // The picker and the server must agree to the minute, including at the
    // edges of every window (docs/PRD.md §12.3).
    for (const slot of generatePickupSlots(aden("08:00"), realConfig)) {
      const result = validatePickupTime({
        now: aden("08:00"),
        requested: slot,
        prepMinutes: 0,
        config: realConfig,
        onlineOrderingPaused: false,
      });
      expect({ slot: slot.toISOString(), valid: result.valid }).toEqual({
        slot: slot.toISOString(),
        valid: true,
      });
    }
  });
});
