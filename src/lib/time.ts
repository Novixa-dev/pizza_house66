// Timezone-aware time helpers.
//
// Why this exists: business hours are stored as wall-clock strings ("16:00")
// that mean 16:00 *in the restaurant's city*. The server that evaluates them
// runs in UTC on most hosts. Doing the arithmetic with the server's local
// clock — `new Date().setHours(16, 0)` — silently shifts every pickup slot by
// the host's offset, which would open ordering three hours late in Al Mukalla
// and produce kitchen-release times that are simply wrong.
//
// So every conversion between "a wall clock reading in the restaurant's
// timezone" and "an absolute instant" goes through here, driven by the
// restaurant's IANA timezone (Restaurant.timezone), using only Intl — no
// dependency, and correct for any zone the product is later sold into.

export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  minute: number;
  second: number;
  /** 0 = Sunday … 6 = Saturday, matching BusinessHour.dayOfWeek. */
  weekday: number;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

/** Reads the wall-clock reading an observer in `timeZone` would see at `instant`. */
export function getZonedParts(instant: Date, timeZone: string): ZonedParts {
  const parts = partsFormatter(timeZone).formatToParts(instant);
  const lookup: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") lookup[part.type] = part.value;
  }
  return {
    year: Number(lookup.year),
    month: Number(lookup.month),
    day: Number(lookup.day),
    hour: Number(lookup.hour),
    minute: Number(lookup.minute),
    second: Number(lookup.second),
    weekday: WEEKDAY_INDEX[lookup.weekday] ?? 0,
  };
}

/** The zone's UTC offset, in milliseconds, at a given instant. */
export function getTimeZoneOffsetMs(instant: Date, timeZone: string): number {
  const p = getZonedParts(instant, timeZone);
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  // Intl drops milliseconds, so compare against a millisecond-truncated instant.
  return asIfUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/**
 * Converts a wall-clock reading in `timeZone` to the absolute instant it
 * denotes. Two passes so that readings near a DST transition resolve against
 * the offset actually in force at the result (Yemen has no DST, but the
 * platform is meant to travel — docs/PRD.md §89).
 */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  const naive = Date.UTC(year, month - 1, day, hour, minute, 0);
  const firstGuess = new Date(naive - getTimeZoneOffsetMs(new Date(naive), timeZone));
  const refinedOffset = getTimeZoneOffsetMs(firstGuess, timeZone);
  return new Date(naive - refinedOffset);
}

/** Parses "HH:mm" into hours and minutes, rejecting anything malformed. */
export function parseHHmm(value: string): { hour: number; minute: number } {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) throw new Error(`Invalid time-of-day value: ${value}`);
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 24 || minute > 59) throw new Error(`Invalid time-of-day value: ${value}`);
  return { hour, minute };
}

/** Formats a zoned wall clock back to "HH:mm". */
export function formatHHmm(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** The instant at `hhmm` on the calendar day that `dayAnchor` falls on in `timeZone`. */
export function zonedDateAtTime(dayAnchor: Date, hhmm: string, timeZone: string): Date {
  const { year, month, day } = getZonedParts(dayAnchor, timeZone);
  const { hour, minute } = parseHHmm(hhmm);
  return zonedTimeToUtc(year, month, day, hour, minute, timeZone);
}

/** Midnight (start of day) in `timeZone` for the calendar day containing `instant`. */
export function startOfZonedDay(instant: Date, timeZone: string): Date {
  const { year, month, day } = getZonedParts(instant, timeZone);
  return zonedTimeToUtc(year, month, day, 0, 0, timeZone);
}

/** Same calendar day in `timeZone`? */
export function isSameZonedDay(a: Date, b: Date, timeZone: string): boolean {
  const pa = getZonedParts(a, timeZone);
  const pb = getZonedParts(b, timeZone);
  return pa.year === pb.year && pa.month === pb.month && pa.day === pb.day;
}

export function addDays(instant: Date, days: number): Date {
  return new Date(instant.getTime() + days * 24 * 60 * 60 * 1000);
}

export function addMinutes(instant: Date, minutes: number): Date {
  return new Date(instant.getTime() + minutes * 60 * 1000);
}

/**
 * The calendar date, as a UTC-midnight `Date`, that `instant` falls on in
 * `timeZone`. This is the shape Postgres `@db.Date` columns round-trip
 * cleanly, so schedule overrides compare reliably.
 */
export function toDateOnly(instant: Date, timeZone: string): Date {
  const { year, month, day } = getZonedParts(instant, timeZone);
  return new Date(Date.UTC(year, month - 1, day));
}

// `-u-nu-latn` pins the numbering system to Western-Arabic digits while
// keeping Arabic month names, weekday names and the ص/م marker.
//
// Without it, `ar-YE` renders Arabic-Indic digits (٠٤:١٥) while `formatMoney`
// renders Western ones (2,200) — so a single kitchen ticket or order row
// shows two different digit systems side by side. The reasoning in
// `src/lib/money.ts` for choosing Western digits applies at least as strongly
// here: pickup times sit in scannable columns that staff read at a glance
// and compare against a clock.
const LOCALE_TAG = { ar: "ar-YE-u-nu-latn", en: "en-GB" } as const;

/** Localized time of day, e.g. "7:30 م" / "19:30", rendered in restaurant time. */
export function formatTime(instant: Date, timeZone: string, locale: "ar" | "en"): string {
  return new Intl.DateTimeFormat(LOCALE_TAG[locale], {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: locale === "ar",
  }).format(instant);
}

/** Localized date, e.g. "الجمعة 25 سبتمبر" / "Fri 25 Sep". */
export function formatDate(instant: Date, timeZone: string, locale: "ar" | "en"): string {
  return new Intl.DateTimeFormat(LOCALE_TAG[locale], {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(instant);
}

/** Localized date and time together, for order summaries and receipts. */
export function formatDateTime(instant: Date, timeZone: string, locale: "ar" | "en"): string {
  return new Intl.DateTimeFormat(LOCALE_TAG[locale], {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: locale === "ar",
  }).format(instant);
}

/** Whole minutes between two instants, rounded toward zero. */
export function minutesBetween(from: Date, to: Date): number {
  return Math.trunc((to.getTime() - from.getTime()) / 60000);
}
