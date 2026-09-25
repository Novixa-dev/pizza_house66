// Money formatting.
//
// Amounts are integer minor units everywhere in the system (docs/PRD.md §60).
// For YER that means whole rials — the currency has no subunit in practical
// use in this market — but the representation stays integer so that adding a
// two-decimal currency later is a formatting change, not an arithmetic one.

const ZERO_DECIMAL_CURRENCIES = new Set(["YER", "JPY", "KRW", "VND", "IQD", "DJF"]);

export function minorUnitScale(currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency) ? 1 : 100;
}

export function toMajorUnits(minor: number, currency: string): number {
  return minor / minorUnitScale(currency);
}

export function toMinorUnits(major: number, currency: string): number {
  return Math.round(major * minorUnitScale(currency));
}

const CURRENCY_LABEL: Record<string, { ar: string; en: string }> = {
  YER: { ar: "ريال", en: "YER" },
  SAR: { ar: "ر.س", en: "SAR" },
  USD: { ar: "دولار", en: "USD" },
};

/**
 * Formats an amount for display.
 *
 * Digits are rendered as Western Arabic numerals even in Arabic: prices sit
 * next to each other in lists that customers scan and compare, and mixing
 * Eastern-Arabic numerals into a scannable price column measurably slows
 * that comparison down. The surrounding text stays fully Arabic.
 */
export function formatMoney(minor: number, currency: string, locale: "ar" | "en"): string {
  const scale = minorUnitScale(currency);
  const amount = minor / scale;
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: scale === 1 ? 0 : 2,
    maximumFractionDigits: scale === 1 ? 0 : 2,
  }).format(amount);

  const label = CURRENCY_LABEL[currency]?.[locale] ?? currency;
  return `${formatted} ${label}`;
}

/** Signed form for option price deltas, e.g. "+300 ريال". */
export function formatMoneyDelta(minor: number, currency: string, locale: "ar" | "en"): string {
  if (minor === 0) return "";
  const sign = minor > 0 ? "+" : "−";
  return `${sign}${formatMoney(Math.abs(minor), currency, locale)}`;
}

/** Plain number formatting for counts, kept out of Arabic-Indic digits too. */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatPercent(value: number, locale: "ar" | "en"): string {
  // `-u-nu-latn` for the same reason as every other number here — Arabic
  // keeps its own percent sign placement, but the digits stay Western.
  return new Intl.NumberFormat(locale === "ar" ? "ar-YE-u-nu-latn" : "en-US", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
}
