import type { Metadata } from "next";
import { getLocale, pick } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { buildMetadata } from "@/lib/seo";
import { WIKIMEDIA_CREDITS } from "@/lib/photo-credits";
import { Card, SectionHeading } from "@/components/ui";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = getDictionary(locale);
  return buildMetadata({
    title: t.pages.creditsTitle,
    description: t.pages.creditsLead,
    path: "/credits",
    locale,
  });
}

/**
 * Attribution for the menu photographs.
 *
 * Not decoration: six of the seven Wikimedia pictures are CC BY or CC BY-SA,
 * and those licences require the photographer to be named wherever the work
 * appears. The page is linked from the footer of every page, which is the
 * attribution practice Creative Commons' reuse guidance accepts for the web.
 */
export default async function CreditsPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);

  return (
    <div className="container-page py-10">
      <SectionHeading level={1} title={t.pages.creditsTitle} subtitle={t.pages.creditsLead} />

      <p className="mb-8 max-w-prose text-ink-soft">{t.pages.creditsIntro}</p>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[42rem] text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-muted">
              <th className="p-3 text-start font-semibold">{t.pages.creditsDish}</th>
              <th className="p-3 text-start font-semibold">{t.pages.creditsAuthor}</th>
              <th className="p-3 text-start font-semibold">{t.pages.creditsLicense}</th>
              <th className="p-3 text-start font-semibold">{t.pages.creditsSource}</th>
            </tr>
          </thead>
          <tbody>
            {WIKIMEDIA_CREDITS.map((credit) => (
              <tr key={credit.file} className="border-b border-line last:border-0">
                <td className="p-3 font-semibold text-ink">
                  {pick(locale, credit.dishAr, credit.dishEn)}
                </td>
                <td className="p-3 text-ink-soft">{credit.author}</td>
                <td className="p-3">
                  <a
                    href={credit.licenseUrl}
                    rel="license noopener noreferrer nofollow"
                    target="_blank"
                    className="inline-flex min-h-6 items-center text-ink-soft underline hover:text-brand"
                  >
                    {credit.license}
                  </a>
                </td>
                <td className="p-3">
                  <a
                    href={credit.sourceUrl}
                    rel="noopener noreferrer nofollow"
                    target="_blank"
                    className="inline-flex min-h-6 items-center text-ink-soft underline hover:text-brand"
                  >
                    Wikimedia Commons
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="mt-6 space-y-2 text-sm text-ink-muted">
        <p>{t.pages.creditsUnsplash}</p>
        <p>{t.pages.creditsDrinks}</p>
      </div>
    </div>
  );
}
