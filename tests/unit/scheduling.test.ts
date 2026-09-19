import { describe, expect, it } from "vitest";
import {
  computeKitchenReleaseAt,
  isWithinBusinessHours,
  nextValidPickupSlot,
  validatePickupTime,
  type BusinessHourRule,
} from "@/lib/scheduling";

const dailyHours: BusinessHourRule[] = Array.from({ length: 7 }, (_, dayOfWeek) => ({
  dayOfWeek,
  opensAt: "16:00",
  closesAt: "00:00",
  closed: false,
}));

describe("computeKitchenReleaseAt", () => {
  it("matches the PRD worked example: order at 16:00, pickup at 19:00, prep 25min -> release 18:35", () => {
    const pickup = new Date("2026-01-10T19:00:00");
    const release = computeKitchenReleaseAt(pickup, 25);
    expect(release.toISOString()).toBe(new Date("2026-01-10T18:35:00").toISOString());
  });

  it("matches docs/PROJECT_ORIGIN.md section 4: 8pm pickup, 15min prep -> 7:45pm release", () => {
    const pickup = new Date("2026-01-10T20:00:00");
    const release = computeKitchenReleaseAt(pickup, 15);
    expect(release.getHours()).toBe(19);
    expect(release.getMinutes()).toBe(45);
  });
});

describe("isWithinBusinessHours", () => {
  it("treats a closing time past midnight as open into the next calendar day", () => {
    // Tuesday 2026-01-06, hours 16:00 -> 00:00 (next day)
    expect(isWithinBusinessHours(new Date("2026-01-06T23:30:00"), dailyHours, [])).toBe(true);
    expect(isWithinBusinessHours(new Date("2026-01-06T15:59:00"), dailyHours, [])).toBe(false);
  });

  it("respects a schedule override that closes an otherwise-open day", () => {
    const overrides = [{ date: new Date("2026-01-06T00:00:00"), closed: true }];
    expect(isWithinBusinessHours(new Date("2026-01-06T18:00:00"), dailyHours, overrides)).toBe(false);
  });
});

describe("validatePickupTime", () => {
  const now = new Date("2026-01-06T16:00:00");

  it("rejects a time before the earliest possible preparation completes", () => {
    const requested = new Date("2026-01-06T16:10:00");
    const result = validatePickupTime({
      now,
      requested,
      prepMinutes: 20,
      hours: dailyHours,
      overrides: [],
      onlineOrderingPaused: false,
    });
    expect(result.valid).toBe(false);
    expect(result.reasonCode).toBe("TOO_SOON");
  });

  it("accepts a time far enough ahead and within business hours", () => {
    const requested = new Date("2026-01-06T20:00:00");
    const result = validatePickupTime({
      now,
      requested,
      prepMinutes: 20,
      hours: dailyHours,
      overrides: [],
      onlineOrderingPaused: false,
    });
    expect(result.valid).toBe(true);
  });

  it("rejects any time when online ordering is paused", () => {
    const result = validatePickupTime({
      now,
      requested: new Date("2026-01-06T20:00:00"),
      prepMinutes: 20,
      hours: dailyHours,
      overrides: [],
      onlineOrderingPaused: true,
    });
    expect(result.valid).toBe(false);
    expect(result.reasonCode).toBe("PAUSED");
  });

  it("rejects a time outside business hours", () => {
    const result = validatePickupTime({
      now,
      requested: new Date("2026-01-07T10:00:00"),
      prepMinutes: 20,
      hours: dailyHours,
      overrides: [],
      onlineOrderingPaused: false,
    });
    expect(result.valid).toBe(false);
    expect(result.reasonCode).toBe("CLOSED");
  });
});

describe("nextValidPickupSlot", () => {
  it("snaps forward to the next open slot when starting outside business hours", () => {
    const from = new Date("2026-01-06T10:00:00");
    const slot = nextValidPickupSlot(from, 15, dailyHours, []);
    expect(slot.getHours()).toBe(16);
    expect(slot.getMinutes()).toBe(0);
  });
});
