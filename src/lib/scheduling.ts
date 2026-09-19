// Pickup scheduling — the core "order early, prepare at the right time"
// logic described in docs/PROJECT_ORIGIN.md and docs/PRD.md section 13.
//
// These are pure functions (no I/O) so business rules can be unit tested
// without a database. Server code in src/server/* loads the raw data and
// calls into here.
//
// ASSUMPTION: the server clock and all stored "HH:mm" business-hour strings
// are in the restaurant's local timezone (Asia/Aden, UTC+3). Yemen does not
// observe daylight saving, so this is safe without a timezone library for
// the MVP. Revisit if the platform ever serves a restaurant in another
// timezone (see docs/DECISIONS.md).

export interface BusinessHourRule {
  dayOfWeek: number; // 0 = Sunday .. 6 = Saturday
  opensAt: string; // "HH:mm"
  closesAt: string; // "HH:mm" — may be past midnight, e.g. "00:30"
  closed: boolean;
}

export interface ScheduleOverrideRule {
  date: Date; // calendar date, local
  closed: boolean;
  opensAt?: string | null;
  closesAt?: string | null;
}

export interface OpenWindow {
  opensAt: Date;
  closesAt: Date;
}

function atTime(base: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return d;
}

function sameCalendarDate(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Returns the open window(s) that cover `forDate`'s calendar day, honoring
 * schedule overrides first, then the weekly business-hour rules. A window
 * whose closesAt crosses midnight is returned with closesAt on the next day.
 */
export function resolveOpenWindows(
  forDate: Date,
  hours: BusinessHourRule[],
  overrides: ScheduleOverrideRule[]
): OpenWindow[] {
  const override = overrides.find((o) => sameCalendarDate(o.date, forDate));
  if (override) {
    if (override.closed || !override.opensAt || !override.closesAt) return [];
    return [buildWindow(forDate, override.opensAt, override.closesAt)];
  }

  const rule = hours.find((h) => h.dayOfWeek === forDate.getDay());
  if (!rule || rule.closed) return [];
  return [buildWindow(forDate, rule.opensAt, rule.closesAt)];
}

function buildWindow(forDate: Date, opensAt: string, closesAt: string): OpenWindow {
  const opens = atTime(forDate, opensAt);
  let closes = atTime(forDate, closesAt);
  if (closes <= opens) {
    closes = new Date(closes.getTime() + 24 * 60 * 60 * 1000);
  }
  return { opensAt: opens, closesAt: closes };
}

/** Is `at` within any open window covering its own day or the previous day's overnight window? */
export function isWithinBusinessHours(
  at: Date,
  hours: BusinessHourRule[],
  overrides: ScheduleOverrideRule[]
): boolean {
  const today = resolveOpenWindows(at, hours, overrides);
  const yesterday = new Date(at.getTime() - 24 * 60 * 60 * 1000);
  const prevDayWindows = resolveOpenWindows(yesterday, hours, overrides);
  return [...today, ...prevDayWindows].some((w) => at >= w.opensAt && at <= w.closesAt);
}

export interface PickupValidationInput {
  now: Date;
  requested: Date;
  prepMinutes: number;
  hours: BusinessHourRule[];
  overrides: ScheduleOverrideRule[];
  onlineOrderingPaused: boolean;
}

export interface PickupValidationResult {
  valid: boolean;
  reasonCode?: "PAUSED" | "IN_PAST" | "TOO_SOON" | "CLOSED";
  earliestValid: Date;
}

/** The earliest a pickup could physically happen right now, ignoring business hours. */
export function earliestPossiblePickup(now: Date, prepMinutes: number): Date {
  return new Date(now.getTime() + prepMinutes * 60 * 1000);
}

/**
 * Finds the next valid pickup slot at/after `from`, snapped to the
 * restaurant's slot interval, that falls inside an open window.
 * Searches up to 14 days ahead before giving up.
 */
export function nextValidPickupSlot(
  from: Date,
  slotIntervalMinutes: number,
  hours: BusinessHourRule[],
  overrides: ScheduleOverrideRule[]
): Date {
  const snapped = snapUpToInterval(from, slotIntervalMinutes);
  for (let i = 0; i < (14 * 24 * 60) / slotIntervalMinutes; i++) {
    const candidate = new Date(snapped.getTime() + i * slotIntervalMinutes * 60 * 1000);
    if (isWithinBusinessHours(candidate, hours, overrides)) return candidate;
  }
  throw new Error("No valid pickup slot found in the next 14 days");
}

function snapUpToInterval(date: Date, intervalMinutes: number): Date {
  const d = new Date(date);
  const ms = intervalMinutes * 60 * 1000;
  return new Date(Math.ceil(d.getTime() / ms) * ms);
}

/** Validates a customer-selected pickup time against all business rules. */
export function validatePickupTime(input: PickupValidationInput): PickupValidationResult {
  const { now, requested, prepMinutes, hours, overrides, onlineOrderingPaused } = input;

  const earliestPossible = earliestPossiblePickup(now, prepMinutes);

  if (onlineOrderingPaused) {
    return { valid: false, reasonCode: "PAUSED", earliestValid: earliestPossible };
  }
  if (requested.getTime() < now.getTime()) {
    return { valid: false, reasonCode: "IN_PAST", earliestValid: earliestPossible };
  }
  if (requested.getTime() < earliestPossible.getTime()) {
    return { valid: false, reasonCode: "TOO_SOON", earliestValid: earliestPossible };
  }
  if (!isWithinBusinessHours(requested, hours, overrides)) {
    return { valid: false, reasonCode: "CLOSED", earliestValid: earliestPossible };
  }
  return { valid: true, earliestValid: earliestPossible };
}

/**
 * The heart of the scheduled-ordering feature: preparation should not start
 * the moment the order is placed, only when it needs to in order to be
 * ready for the requested pickup time.
 */
export function computeKitchenReleaseAt(requestedPickupAt: Date, prepMinutes: number): Date {
  return new Date(requestedPickupAt.getTime() - prepMinutes * 60 * 1000);
}

/** True once the current time has reached an order's planned kitchen release. */
export function isReadyForKitchenRelease(kitchenReleaseAt: Date, now: Date): boolean {
  return now.getTime() >= kitchenReleaseAt.getTime();
}
