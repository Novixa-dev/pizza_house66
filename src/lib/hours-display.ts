import type { Locale } from "./i18n/dictionaries";

// Turns a week of BusinessHour rows into the handful of lines a human wants
// to read. "16:00–23:30 every day" beats seven identical rows, and grouping
// runs of identical days is what any well-made opening-hours block does.
//
// A day holds as many windows as the kitchen runs services, so this has to
// join them rather than pick one. It did pick one — a Map keyed on the day,
// which keeps whichever row came last — and the morning service disappeared
// from the footer, the homepage and the contact page the moment the schema
// allowed two. The times were right in the database and wrong on the page,
// which is the worst way for this to be wrong.

export interface HoursRow {
  label: string;
  value: string;
  closed: boolean;
}

export interface BusinessHourLike {
  dayOfWeek: number;
  opensAt: string;
  closesAt: string;
  closed: boolean;
}

export function formatOpeningHours(
  hours: BusinessHourLike[],
  locale: Locale,
  dayNames: readonly string[]
): HoursRow[] {
  if (hours.length === 0) return [];

  // Week runs Sunday..Saturday to match BusinessHour.dayOfWeek. Each day gets
  // every one of its open windows, earliest first.
  const byDay = new Map<number, BusinessHourLike[]>();
  for (const hour of hours) {
    if (hour.closed) continue;
    byDay.set(hour.dayOfWeek, [...(byDay.get(hour.dayOfWeek) ?? []), hour]);
  }
  const ordered = Array.from({ length: 7 }, (_, day) =>
    (byDay.get(day) ?? []).sort((a, b) => a.opensAt.localeCompare(b.opensAt))
  );

  const groups: { days: number[]; windows: BusinessHourLike[] }[] = [];
  for (let day = 0; day < 7; day++) {
    const windows = ordered[day]!;
    const previous = groups[groups.length - 1];
    if (previous && sameSchedule(previous.windows, windows)) {
      previous.days.push(day);
    } else {
      groups.push({ days: [day], windows });
    }
  }

  const everyDay = locale === "ar" ? "كل الأيام" : "Every day";
  const closedLabel = locale === "ar" ? "مغلق" : "Closed";
  // Arabic separates a list with a comma that faces the other way.
  const separator = locale === "ar" ? "، " : ", ";

  return groups.map((group) => {
    const label =
      group.days.length === 7
        ? everyDay
        : group.days.length === 1
          ? dayNames[group.days[0]!]!
          : `${dayNames[group.days[0]!]} – ${dayNames[group.days[group.days.length - 1]!]}`;

    if (group.windows.length === 0) {
      return { label, value: closedLabel, closed: true };
    }
    return {
      label,
      // An en dash reads as a range in both scripts; RTL handles it correctly
      // because the times themselves are isolated by the .numeric class.
      value: group.windows
        .map((window) => `${window.opensAt} – ${window.closesAt}`)
        .join(separator),
      closed: false,
    };
  });
}

function sameSchedule(a: BusinessHourLike[], b: BusinessHourLike[]): boolean {
  if (a.length !== b.length) return false;
  return a.every(
    (window, index) =>
      window.opensAt === b[index]!.opensAt && window.closesAt === b[index]!.closesAt
  );
}

/** Schema.org `openingHours` strings for the LocalBusiness JSON-LD block. */
export function toSchemaOpeningHours(hours: BusinessHourLike[]): string[] {
  const CODES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  return hours
    .filter((hour) => !hour.closed)
    .map((hour) => {
      // Schema.org has no way to express "closes after midnight" other than
      // 23:59, and a literal 00:00 would read as "closes at the start of the
      // same day".
      const closes = hour.closesAt === "00:00" ? "23:59" : hour.closesAt;
      return `${CODES[hour.dayOfWeek]} ${hour.opensAt}-${closes}`;
    });
}
