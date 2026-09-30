import "server-only";

import { cookies, headers } from "next/headers";
import type { Locale } from "./dictionaries";
import { DEFAULT_LOCALE, LOCALE_COOKIE_NAME } from "./pick";

// Locale *resolution* — the part that needs the request.
//
// Arabic is the default because this is an Arabic-first deployment
// (docs/PRD.md §47); English is opt-in, not the fallback. The choice is
// stored in a cookie rather than the URL — docs/DECISIONS.md records that
// tradeoff and what it costs for per-language SEO.
//
// The pure helpers (`pick`, `otherLocale`, `directionFor`) live in ./pick so
// they can be used by components that also render in the browser.

export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const stored = store.get(LOCALE_COOKIE_NAME)?.value;
  if (stored === "en" || stored === "ar") return stored;

  // No explicit choice yet: honour the browser's preference if it clearly
  // asks for English, otherwise serve Arabic.
  const accept = (await headers()).get("accept-language")?.toLowerCase() ?? "";
  const arIndex = accept.indexOf("ar");
  const enIndex = accept.indexOf("en");
  if (enIndex !== -1 && (arIndex === -1 || enIndex < arIndex)) return "en";
  return DEFAULT_LOCALE;
}

export { LOCALE_COOKIE_NAME, DEFAULT_LOCALE, otherLocale, directionFor, pick, pickValue, joinList } from "./pick";
