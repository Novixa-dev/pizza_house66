// All monetary values are stored as integer minor units (see docs/DATABASE.md
// "Currency and Money" — YER is treated as a zero-decimal currency in this
// deployment, matching how prices are actually quoted in the local market).
// Never use floating point for money.

export function formatMoney(minor: number, currency: string, locale: "ar" | "en"): string {
  const amount = minor;
  const formatted = new Intl.NumberFormat(locale === "ar" ? "ar-YE" : "en-US", {
    maximumFractionDigits: 0,
  }).format(amount);

  if (currency === "YER") {
    return locale === "ar" ? `${formatted} ريال` : `${formatted} YER`;
  }
  return `${formatted} ${currency}`;
}
