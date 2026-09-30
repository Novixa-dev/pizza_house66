// Human-readable durations for the kitchen display and the staff screens.
//
// The kitchen board is the one screen in the product read at a glance, from
// across a room, by someone holding a pizza peel. It was rendering every
// duration as raw minutes whatever the size, so an order five days stale wore
// a red badge reading "متأخر 6862" — four digits, no unit, and no way to tell
// at a glance whether that was minutes, seconds or money.
//
// `Intl.NumberFormat` with `style: "unit"` is what picks the right word, and
// it is the only thing that gets Arabic right: the dual ("دقيقتان"), the
// small plural for 3–10 ("3 دقائق") and the accusative singular from 11
// ("11 دقيقة") are three different forms of one word, and no amount of
// string concatenation produces them. The same reasoning put money in
// `Intl.NumberFormat` and times in `Intl.DateTimeFormat`.

import { LOCALE_TAG } from "./time";

const unit = (value: number, name: "minute" | "hour" | "day", locale: "ar" | "en") =>
  new Intl.NumberFormat(LOCALE_TAG[locale], {
    style: "unit",
    unit: name,
    unitDisplay: "long",
  }).format(value);

/** "and" in the reader's language: Arabic writes "ساعة و15 دقيقة", English a space. */
const join = (parts: string[], locale: "ar" | "en") =>
  new Intl.ListFormat(LOCALE_TAG[locale], { style: "narrow", type: "unit" }).format(parts);

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

/**
 * A duration said the way a person would say it.
 *
 *   45   → "45 دقيقة"            / "45 minutes"
 *   75   → "ساعة و15 دقيقة"       / "1 hour 15 minutes"
 *   318  → "5 ساعات"             / "5 hours"
 *   6862 → "4 أيام"              / "4 days"
 *
 * The second unit appears only while the first is small enough for it to
 * change a decision. Once something is five hours out, the minutes are noise
 * on a board that has to be read in a second — but at an hour and a quarter
 * they are the difference between starting now and starting later.
 */
export function describeDuration(totalMinutes: number, locale: "ar" | "en"): string {
  const minutes = Math.max(0, Math.round(totalMinutes));

  if (minutes < MINUTES_PER_HOUR) return unit(minutes, "minute", locale);

  if (minutes < MINUTES_PER_DAY) {
    const hours = Math.floor(minutes / MINUTES_PER_HOUR);
    const rest = minutes % MINUTES_PER_HOUR;
    if (hours < 3 && rest > 0) {
      return join([unit(hours, "hour", locale), unit(rest, "minute", locale)], locale);
    }
    return unit(Math.round(minutes / MINUTES_PER_HOUR), "hour", locale);
  }

  const days = Math.floor(minutes / MINUTES_PER_DAY);
  const restHours = Math.round((minutes % MINUTES_PER_DAY) / MINUTES_PER_HOUR);
  if (days < 3 && restHours > 0) {
    return join([unit(days, "day", locale), unit(restHours, "hour", locale)], locale);
  }
  return unit(days, "day", locale);
}
