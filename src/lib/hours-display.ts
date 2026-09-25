import type { Locale } from "./i18n/dictionaries";

// Turns seven BusinessHour rows into the handful of lines a human wants to
// read. "16:00–00:00 every day" beats seven identical rows, and grouping runs
// of identical days is what any well-made opening-hours block does.

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

  // Week runs Sunday..Saturday to match BusinessHour.dayOfWeek.
  const byDay = new Map(hours.map((hour) => [hour.dayOfWeek, hour]));
  const ordered = Array.from({ length: 7 }, (_, day) => byDay.get(day) ?? null);

  const groups: { days: number[]; hour: BusinessHourLike | null }[] = [];
  for (let day = 0; day < 7; day++) {
    const hour = ordered[day];
    const previous = groups[groups.length - 1];
    if (previous && sameSchedule(previous.hour, hour)) {
      previous.days.push(day);
    } else {
      groups.push({ days: [day], hour });
    }
  }

  const everyDay = locale === "ar" ? "كل الأيام" : "Every day";
  const closedLabel = locale === "ar" ? "مغلق" : "Closed";

  return groups.map((group) => {
    const label =
      group.days.length === 7
        ? everyDay
        : group.days.length === 1
          ? dayNames[group.days[0]]
          : `${dayNames[group.days[0]]} – ${dayNames[group.days[group.days.length - 1]]}`;

    if (!group.hour || group.hour.closed) {
      return { label, value: closedLabel, closed: true };
    }
    return {
      label,
      // An en dash reads as a range in both scripts; RTL handles it correctly
      // because the times themselves are isolated by the .numeric class.
      value: `${group.hour.opensAt} – ${group.hour.closesAt}`,
      closed: false,
    };
  });
}

function sameSchedule(a: BusinessHourLike | null, b: BusinessHourLike | null): boolean {
  if (!a || !b) return a === b;
  return a.closed === b.closed && a.opensAt === b.opensAt && a.closesAt === b.closesAt;
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
