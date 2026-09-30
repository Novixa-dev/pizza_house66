// Page metadata.
//
// Every public page needs the same four things — a title, a description, a
// canonical URL and an Open Graph block that agrees with all three. Written
// out per page they drift: a canonical that points at the wrong path, or an
// og:url still on localhost, is invisible until someone shares the link.

import type { Metadata } from "next";
import type { Locale } from "./i18n/dictionaries";
import { absoluteUrl } from "./site";

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
    },
  };
}
