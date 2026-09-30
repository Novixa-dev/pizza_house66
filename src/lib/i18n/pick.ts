import type { Locale } from "./dictionaries";

// Client-safe locale helpers.
//
// These are pure functions over a locale value, so they are importable from
// anywhere. `./locale` is the server-only counterpart: it reads cookies and
// request headers to *determine* the locale, which is why it can't be pulled
// into a component that also renders in the browser.

export const LOCALE_COOKIE_NAME = "ph_locale";

export const DEFAULT_LOCALE: Locale = "ar";

export function otherLocale(locale: Locale): Locale {
  return locale === "ar" ? "en" : "ar";
}

export function directionFor(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

/** Picks the right column from a bilingual pair without a ternary at each use. */
export function pick<T>(locale: Locale, ar: T, en: T): T {
  return locale === "ar" ? ar : en;
}

/** Picks one side of an `{ ar, en }` object. */
export function pickValue<T>(locale: Locale, pair: { ar: T; en: T }): T {
  return locale === "ar" ? pair.ar : pair.en;
}

/** Joins a list with the separator the language actually uses. */
export function joinList(locale: Locale, parts: string[]): string {
  return parts.join(locale === "ar" ? "، " : ", ");
}
