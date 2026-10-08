// Page metadata.
//
// Every public page needs the same four things — a title, a description, a
// canonical URL and an Open Graph block that agrees with all three. Written
// out per page they drift: a canonical that points at the wrong path, or an
// og:url still on localhost, is invisible until someone shares the link.

import type { Metadata } from "next";
import type { Locale } from "./i18n/dictionaries";
import { absoluteUrl } from "./site";

const SHARE_CARD_ALT = "بيتزا هاوس المكلا — اطلب مسبقًا، استلم طازجًا";

export function buildMetadata({
  title,
  description,
  path,
  locale,
  index = true,
}: {
  title: string;
  description: string;
  path: string;
  locale: Locale;
  index?: boolean;
}): Metadata {
  const url = absoluteUrl(path);
  return {
    title,
    description,
    alternates: { canonical: path },
    robots: index ? undefined : { index: false, follow: true },
    openGraph: {
      title,
      description,
      url,
      type: "website",
      locale: locale === "ar" ? "ar_YE" : "en_US",
      // Stated here, not inherited: a page that defines its own `openGraph`
      // replaces the parent's, and the site-wide card (a file convention at
      // the root) does not survive that. Every page built with this helper
      // used to be shared as a bare title with no picture at all.
      images: [{ url: absoluteUrl("/opengraph-image"), width: 1200, height: 630, alt: SHARE_CARD_ALT }],
    },
  };
}
