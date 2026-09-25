// Pickup scheduling — the "order early, prepare at the right time" logic that
// the whole product was conceived around (docs/PROJECT_ORIGIN.md §4,
// docs/PRD.md §12–§14, §26).
//
// Everything here is a pure function over explicit inputs, including the
// clock and the restaurant's timezone. No I/O, no `new Date()` without a
// caller-supplied `now`. That is what makes the rules that most need to be
// correct — which slots a customer may pick, and when the kitchen starts —
// testable to the minute (tests/unit/scheduling.test.ts).

import {
  addDays,
  addMinutes,
  getZonedParts,
  isSameZonedDay,
  startOfZonedDay,
  zonedDateAtTime,
} from "./time";

export interface BusinessHourRule {
  dayOfWeek: number; // 0 = Sunday … 6 = Saturday
  opensAt: string; // "HH:mm" in restaurant time
  closesAt: string; // "HH:mm"; may be past midnight, e.g. "00:30"
  closed: boolean;
}

export interface ScheduleOverrideRule {
  date: Date; // calendar date in restaurant time
  closed: boolean;
  opensAt?: string | null;
  closesAt?: string | null;
}

export interface OpenWindow {
  opensAt: Date;
  closesAt: Date;
}

export interface SchedulingConfig {
  timeZone: string;
  hours: BusinessHourRule[];
  overrides: ScheduleOverrideRule[];
  slotIntervalMinutes: number;
  maxScheduleDaysAhead: number;
}

/**
 * The open window for the calendar day that `dayAnchor` falls on. A closing
 * time at or before the opening time means the restaurant trades past
 * midnight, so the window is returned ending on the following day — the
 * 16:00–00:00 shift the restaurant actually works.
 */
export function resolveOpenWindow(
  dayAnchor: Date,
  hours: BusinessHourRule[],
  overrides: ScheduleOverrideRule[],
  timeZone: string
): OpenWindow | null {
  const override = overrides.find((o) => isSameZonedDay(o.date, dayAnchor, timeZone));
  if (override) {
    if (override.closed || !override.opensAt || !override.closesAt) return null;
    return buildWindow(dayAnchor, override.opensAt, override.closesAt, timeZone);
  }

  const weekday = getZonedParts(dayAnchor, timeZone).weekday;
  const rule = hours.find((h) => h.dayOfWeek === weekday);
  if (!rule || rule.closed) return null;
  return buildWindow(dayAnchor, rule.opensAt, rule.closesAt, timeZone);
}

function buildWindow(
  dayAnchor: Date,
  opensAt: string,
  closesAt: string,
  timeZone: string
): OpenWindow {
  const opens = zonedDateAtTime(dayAnchor, opensAt, timeZone);
  let closes = zonedDateAtTime(dayAnchor, closesAt, timeZone);
  if (closes.getTime() <= opens.getTime()) {
    closes = zonedDateAtTime(addDays(dayAnchor, 1), closesAt, timeZone);
  }
  return { opensAt: opens, closesAt: closes };
}

/**
 * Whether `at` is inside an open window. Checks the previous calendar day too,
 * because an overnight window that opened yesterday can still be open now.
 */
export function isWithinBusinessHours(
  at: Date,
  hours: BusinessHourRule[],
  overrides: ScheduleOverrideRule[],
  timeZone: string
): boolean {
  for (const anchor of [at, addDays(at, -1)]) {
    const window = resolveOpenWindow(anchor, hours, overrides, timeZone);
    if (window && at >= window.opensAt && at <= window.closesAt) return true;
  }
  return false;
}

/** Is the restaurant open for walk-ins right now? Drives the "Open now" badge. */
export function isOpenNow(
  now: Date,
  hours: BusinessHourRule[],
  overrides: ScheduleOverrideRule[],
  timeZone: string
): boolean {
  return isWithinBusinessHours(now, hours, overrides, timeZone);
}

/** The earliest a pickup could physically happen, ignoring business hours. */
export function earliestPossiblePickup(now: Date, prepMinutes: number): Date {
  return addMinutes(now, prepMinutes);
}

/** Rounds an instant up to the next slot boundary within the restaurant's day. */
export function snapUpToSlot(
  instant: Date,
  slotIntervalMinutes: number,
  timeZone: string
): Date {
  const dayStart = startOfZonedDay(instant, timeZone);
  const slotMs = slotIntervalMinutes * 60 * 1000;
  const elapsed = instant.getTime() - dayStart.getTime();
  const slots = Math.ceil(elapsed / slotMs);
  return new Date(dayStart.getTime() + slots * slotMs);
}

/**
 * Every bookable pickup slot from `from` onward, across up to
 * `maxScheduleDaysAhead` days. This is the single source of truth the slot
 * picker renders and the server re-checks on submit, so a customer can never
 * be shown a time the server would then reject (docs/PRD.md §12.3).
 */
export function generatePickupSlots(
  from: Date,
  config: SchedulingConfig,
  limit = 400
): Date[] {
  const { timeZone, hours, overrides, slotIntervalMinutes, maxScheduleDaysAhead } = config;
  const slots: Date[] = [];
  const horizon = addDays(from, maxScheduleDaysAhead);

  // Start a day early so an overnight window opened yesterday is included.
  for (let dayOffset = -1; dayOffset <= maxScheduleDaysAhead; dayOffset++) {
    const anchor = addDays(from, dayOffset);
    const window = resolveOpenWindow(anchor, hours, overrides, timeZone);
    if (!window) continue;

    let cursor = snapUpToSlot(
      window.opensAt.getTime() > from.getTime() ? window.opensAt : from,
      slotIntervalMinutes,
      timeZone
    );
    while (cursor <= window.closesAt && cursor <= horizon) {
      if (cursor >= from && cursor >= window.opensAt) {
        slots.push(new Date(cursor));
        if (slots.length >= limit) return dedupeSorted(slots);
      }
      cursor = addMinutes(cursor, slotIntervalMinutes);
    }
  }

  return dedupeSorted(slots);
}

function dedupeSorted(slots: Date[]): Date[] {
  const seen = new Set<number>();
  const out: Date[] = [];
  for (const slot of slots.sort((a, b) => a.getTime() - b.getTime())) {
    if (seen.has(slot.getTime())) continue;
    seen.add(slot.getTime());
    out.push(slot);
  }
  return out;
}

/**
 * The next valid pickup slot at or after `from`. Used for the ASAP path and
 * to suggest an alternative when a customer's chosen time is rejected.
 */
export function nextValidPickupSlot(from: Date, config: SchedulingConfig): Date | null {
  const [first] = generatePickupSlots(from, config, 1);
  return first ?? null;
}

export type PickupRejectionCode = "PAUSED" | "IN_PAST" | "TOO_SOON" | "CLOSED" | "TOO_FAR" | "NOT_A_SLOT";

export interface PickupValidationInput {
  now: Date;
  requested: Date;
  prepMinutes: number;
  config: SchedulingConfig;
  onlineOrderingPaused: boolean;
}

export interface PickupValidationResult {
  valid: boolean;
  reasonCode?: PickupRejectionCode;
  /** Earliest time preparation could finish, regardless of opening hours. */
  earliestPossible: Date;
}

/** Validates a customer-selected pickup time against every business rule. */
export function validatePickupTime(input: PickupValidationInput): PickupValidationResult {
  const { now, requested, prepMinutes, config, onlineOrderingPaused } = input;
  const earliestPossible = earliestPossiblePickup(now, prepMinutes);

  if (onlineOrderingPaused) {
    return { valid: false, reasonCode: "PAUSED", earliestPossible };
  }
  if (requested.getTime() < now.getTime()) {
    return { valid: false, reasonCode: "IN_PAST", earliestPossible };
  }
  if (requested.getTime() < earliestPossible.getTime()) {
    return { valid: false, reasonCode: "TOO_SOON", earliestPossible };
  }
  if (requested.getTime() > addDays(now, config.maxScheduleDaysAhead).getTime()) {
    return { valid: false, reasonCode: "TOO_FAR", earliestPossible };
  }
  if (!isWithinBusinessHours(requested, config.hours, config.overrides, config.timeZone)) {
    return { valid: false, reasonCode: "CLOSED", earliestPossible };
  }
  // Reject arbitrary timestamps: the customer may only take a slot the system
  // actually offers, so capacity accounting stays meaningful.
  const snapped = snapUpToSlot(requested, config.slotIntervalMinutes, config.timeZone);
  if (snapped.getTime() !== requested.getTime()) {
    return { valid: false, reasonCode: "NOT_A_SLOT", earliestPossible };
  }
  return { valid: true, earliestPossible };
}

/**
 * The heart of the scheduled-ordering feature: preparation starts when it has
 * to for the food to be ready at pickup, not when the order arrives.
 *
 *   order placed 16:00, pickup 19:00, prep 25min → kitchen release 18:35
 */
export function computeKitchenReleaseAt(requestedPickupAt: Date, prepMinutes: number): Date {
  return addMinutes(requestedPickupAt, -prepMinutes);
}

/** Has an order's planned kitchen release arrived? */
export function isReadyForKitchenRelease(kitchenReleaseAt: Date, now: Date): boolean {
  return now.getTime() >= kitchenReleaseAt.getTime();
}

/** The capacity bucket an instant belongs to, floored to the slot interval. */
export function slotStartFor(
  instant: Date,
  slotIntervalMinutes: number,
  timeZone: string
): Date {
  const dayStart = startOfZonedDay(instant, timeZone);
  const slotMs = slotIntervalMinutes * 60 * 1000;
  const elapsed = instant.getTime() - dayStart.getTime();
  return new Date(dayStart.getTime() + Math.floor(elapsed / slotMs) * slotMs);
}
