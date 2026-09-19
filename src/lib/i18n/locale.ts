import { cookies } from "next/headers";
import type { Locale } from "./dictionaries";

const LOCALE_COOKIE = "ph_locale";
const DEFAULT_LOCALE: Locale = "ar";

export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return value === "en" ? "en" : DEFAULT_LOCALE;
}

export function otherLocale(locale: Locale): Locale {
  return locale === "ar" ? "en" : "ar";
}

export const LOCALE_COOKIE_NAME = LOCALE_COOKIE;
