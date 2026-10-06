import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, pick } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getRestaurant } from "@/server/restaurant";
import { buildMetadata } from "@/lib/seo";
import { ButtonLink, Card, SectionHeading } from "@/components/ui";
import { ClockIcon, FireIcon, PinIcon } from "@/components/ui/icons";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = getDictionary(locale);
  return buildMetadata({
    title: t.pages.aboutTitle,
    description: t.pages.aboutLead,
    path: "/about",
    locale,
  });
}

export const dynamic = "force-dynamic";

export default async function AboutPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const restaurant = await getRestaurant();
  const about = pick(locale, restaurant.aboutAr, restaurant.aboutEn);
  const address = pick(locale, restaurant.addressAr, restaurant.addressEn);

  const points = [
    {
      icon: <FireIcon className="text-brand" />,
      title: t.home.step1Title,
      body: t.home.step1Body,
    },
    {
      icon: <ClockIcon className="text-gold" />,
      title: t.home.step2Title,
      body: t.home.step2Body,
    },
    {
      icon: <PinIcon className="text-accent" />,
      title: t.home.step3Title,
      body: t.home.step3Body,
    },
  ];

  return (
    <div className="container-page max-w-3xl py-10">
      <SectionHeading level={1} title={t.pages.aboutTitle} subtitle={t.pages.aboutLead} />

      {about ? <p className="text-lg leading-relaxed text-ink-soft">{about}</p> : null}

      <ul className="mt-10 space-y-3">
        {points.map((point) => (
          <Card as="li" key={point.title} className="flex items-start gap-4 p-5">
            <span className="mt-0.5 shrink-0 text-2xl">{point.icon}</span>
            <div>
              <h2 className="font-bold text-ink">{point.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-ink-muted">{point.body}</p>
            </div>
          </Card>
        ))}
      </ul>

      {address ? (
        <Card className="mt-10 p-6">
          <h2 className="font-bold text-ink">{t.pages.contactVisit}</h2>
          <p className="mt-1.5 text-ink-soft">{address}</p>
          <p className="mt-3 text-sm text-ink-muted">{t.pages.onlyBranch}</p>
          <p className="mt-4">
            <Link href="/contact" className="inline-flex min-h-6 items-center font-semibold text-brand underline underline-offset-4">
              {t.pages.contactTitle}
            </Link>
          </p>
        </Card>
      ) : null}

      <div className="mt-10">
        <ButtonLink href="/menu" size="lg">
          {t.common.viewMenu}
        </ButtonLink>
      </div>
    </div>
  );
}
