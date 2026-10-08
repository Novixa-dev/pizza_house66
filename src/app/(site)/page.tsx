import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/db";
import { getLocale, pick } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { describeDuration } from "@/lib/duration";
import { getRestaurant, restaurantStatus } from "@/server/restaurant";
import { getAutomaticPromotions } from "@/server/orders";
import { formatMoney } from "@/lib/money";
import { formatOpeningHours, toSchemaOpeningHours } from "@/lib/hours-display";
import { formatTime } from "@/lib/time";
import { absoluteUrl, telLink, whatsappLink } from "@/lib/site";
import { Badge, ButtonLink, Card, SectionHeading } from "@/components/ui";
import {
  CategoryIcon,
  ClockIcon,
  PhoneIcon,
  PinIcon,
  TagIcon,
  WhatsappIcon,
} from "@/components/ui/icons";
import { ProductCard } from "@/components/product-card";
import { ReturningCustomerPrompt } from "@/components/returning-customer-prompt";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const restaurant = await getRestaurant();
  const status = restaurantStatus(restaurant);

  const [featured, categories, offers] = await Promise.all([
    prisma.product.findMany({
      where: { featured: true, availability: { not: "HIDDEN" } },
      orderBy: { sortOrder: "asc" },
      take: 4,
    }),
    prisma.category.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { products: { where: { availability: { not: "HIDDEN" } } } } } },
    }),
    getAutomaticPromotions(),
  ]);

  const hours = formatOpeningHours(restaurant.businessHours, locale, t.hours.days);
  const whatsapp = whatsappLink(restaurant.whatsapp);
  const tel = telLink(restaurant.phone);
  const about = pick(locale, restaurant.aboutAr, restaurant.aboutEn);

  const faqs = [
    { q: t.faq.q1, a: t.faq.a1 },
    { q: t.faq.q2, a: t.faq.a2 },
    { q: t.faq.q3, a: t.faq.a3 },
    { q: t.faq.q4, a: t.faq.a4 },
    { q: t.faq.q5, a: t.faq.a5 },
  ];

  return (
    <>
      <StructuredData locale={locale} restaurant={restaurant} faqs={faqs} />

      {/* ---------------------------------------------------------------- */}
      {/* Hero                                                              */}
      {/* ---------------------------------------------------------------- */}
      <section className="hero-surface border-b border-line">
        <div className="container-page grid items-center gap-10 py-14 lg:grid-cols-[1.1fr_1fr] lg:py-20">
          <div className="fade-in">
            <p className="mb-4 inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-line-strong bg-surface px-3.5 py-1.5 text-xs font-bold text-brand">
              <ClockIcon />
              {t.home.heroEyebrow}
            </p>
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-ink sm:text-4xl lg:text-5xl">
              {t.home.heroTitle}
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-soft sm:text-lg">
              {t.home.heroSubtitle}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <ButtonLink href="/menu" size="lg">
                {t.common.orderNow}
              </ButtonLink>
              <ButtonLink href="#visit" variant="secondary" size="lg">
                {t.home.visitUs}
              </ButtonLink>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-muted">
              <span className="inline-flex items-center gap-1.5">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${status.open ? "bg-accent" : "bg-ink-muted"}`}
                  aria-hidden="true"
                />
                <strong className="font-semibold text-ink">
                  {status.open ? t.common.openNow : t.common.closedNow}
                </strong>
                {status.open && status.closesAt ? (
                  <span className="numeric">
                    · {formatTime(status.closesAt, restaurant.timezone, locale)}
                  </span>
                ) : null}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ClockIcon />
                {describeDuration(restaurant.defaultPrepMinutes, locale)}
              </span>
              {restaurant.city ? (
                <span className="inline-flex items-center gap-1.5">
                  <PinIcon />
                  {pick(locale, restaurant.addressAr, restaurant.addressEn) ?? restaurant.city}
                </span>
              ) : null}
            </div>
          </div>

          {/* The hero image is the single largest paint on the page, so it is
              the one image marked `priority`. */}
          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="overflow-hidden rounded-[var(--radius-xl)] border border-line bg-surface shadow-[var(--shadow-lg)]">
              <Image
                src="/menu/pizza-special.svg"
                alt={pick(locale, "بيتزا البيت من بيتزا هاوس", "House Special pizza from Pizza House")}
                width={640}
                height={640}
                priority
                className="h-full w-full"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Renders nothing unless this browser remembers an order, so a
          first-time visitor never sees it. */}
      <ReturningCustomerPrompt locale={locale} />

      {/* ---------------------------------------------------------------- */}
      {/* Categories                                                        */}
      {/* ---------------------------------------------------------------- */}
      <section className="container-page py-12">
        <SectionHeading title={t.home.categories} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/menu#${category.slug}`}
              className="card-interactive flex flex-col items-center gap-2 rounded-[var(--radius)] border border-line bg-surface p-5 text-center"
            >
              <span className="text-2xl text-brand">
                <CategoryIcon name={category.icon} />
              </span>
              <span className="font-bold text-ink">
                {pick(locale, category.nameAr, category.nameEn)}
              </span>
              <span className="text-xs text-ink-muted">
                <span className="numeric">{category._count.products}</span> {t.menu.itemsCount}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Featured                                                          */}
      {/* ---------------------------------------------------------------- */}
      {featured.length > 0 ? (
        <section className="container-page py-6">
          <SectionHeading
            title={t.home.featured}
            subtitle={t.home.featuredSubtitle}
            action={
              <Link
                href="/menu"
                className="inline-flex min-h-6 items-center text-sm font-bold text-brand hover:underline"
              >
                {t.common.viewMenu}
              </Link>
            }
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                locale={locale}
                currency={restaurant.currency}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* ---------------------------------------------------------------- */}
      {/* Offers                                                            */}
      {/* ---------------------------------------------------------------- */}
      {offers.length > 0 ? (
        <section id="offers" className="container-page scroll-mt-24 py-12">
          <SectionHeading title={t.home.offersTitle} />
          <div className="grid gap-4 sm:grid-cols-2">
            {offers.map((offer) => (
              <Card key={offer.id} className="flex items-start gap-4 p-5">
                <span className="mt-0.5 rounded-[var(--radius-sm)] bg-gold-soft p-2.5 text-lg text-gold">
                  <TagIcon />
                </span>
                <div className="min-w-0">
                  <p className="font-bold text-ink">{pick(locale, offer.nameAr, offer.nameEn)}</p>
                  {pick(locale, offer.descriptionAr, offer.descriptionEn) ? (
                    <p className="mt-1 text-sm text-ink-muted">
                      {pick(locale, offer.descriptionAr, offer.descriptionEn)}
                    </p>
                  ) : null}
                  {offer.minOrderMinor > 0 ? (
                    <p className="mt-2 text-xs text-ink-muted">
                      {t.promotions.minOrder}:{" "}
                      <span className="numeric font-semibold">
                        {formatMoney(offer.minOrderMinor, restaurant.currency, locale)}
                      </span>
                    </p>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {/* ---------------------------------------------------------------- */}
      {/* How it works — the product's actual idea, explained plainly        */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-y border-line bg-surface-muted py-14">
        <div className="container-page">
          <div className="mb-8 text-center">
            <h2 className="text-xl font-extrabold tracking-tight text-ink sm:text-2xl">
              {t.home.howItWorks}
            </h2>
            <p className="mt-2 text-sm text-ink-muted">{t.home.howItWorksSubtitle}</p>
          </div>
          <ol className="grid gap-5 sm:grid-cols-3">
            {[
              { title: t.home.step1Title, body: t.home.step1Body },
              { title: t.home.step2Title, body: t.home.step2Body },
              { title: t.home.step3Title, body: t.home.step3Body },
            ].map((step, index) => (
              <li key={step.title}>
                <Card className="h-full p-6">
                  <span className="numeric mb-3 inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-pill)] bg-brand text-sm font-extrabold text-brand-ink">
                    {index + 1}
                  </span>
                  <h3 className="mb-1.5 font-bold text-ink">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-ink-muted">{step.body}</p>
                </Card>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Visit us                                                          */}
      {/* ---------------------------------------------------------------- */}
      <section id="visit" className="container-page scroll-mt-24 py-14">
        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <SectionHeading title={t.home.aboutTitle} />
            {about ? <p className="leading-relaxed text-ink-soft">{about}</p> : null}

            <div className="mt-7 flex flex-wrap gap-3">
              {tel ? (
                <a
                  href={tel}
                  className="inline-flex items-center gap-2 rounded-[var(--radius)] border border-line-strong bg-surface px-4 py-2.5 text-sm font-semibold text-ink hover:bg-surface-muted"
                >
                  <PhoneIcon className="text-brand" />
                  <span className="numeric">{restaurant.phone}</span>
                </a>
              ) : null}
              {whatsapp ? (
                <a
                  href={whatsapp}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-[var(--radius)] border border-line-strong bg-surface px-4 py-2.5 text-sm font-semibold text-ink hover:bg-surface-muted"
                >
                  <WhatsappIcon className="text-accent" />
                  {t.common.whatsapp}
                </a>
              ) : null}
              {restaurant.mapUrl ? (
                <a
                  href={restaurant.mapUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-[var(--radius)] border border-line-strong bg-surface px-4 py-2.5 text-sm font-semibold text-ink hover:bg-surface-muted"
                >
                  <PinIcon className="text-brand" />
                  {t.home.findUs}
                </a>
              ) : null}
            </div>
          </div>

          <Card className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-bold text-ink">{t.home.hoursTitle}</h3>
              <Badge tone={status.open ? "success" : "neutral"}>
                {status.open ? t.common.openNow : t.common.closedNow}
              </Badge>
            </div>
            <dl className="space-y-2.5">
              {hours.map((row) => (
                <div key={row.label} className="flex items-baseline justify-between gap-4 text-sm">
                  <dt className="text-ink-soft">{row.label}</dt>
                  <dd
                    className={row.closed ? "text-ink-muted" : "numeric font-semibold text-ink"}
                  >
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* FAQ — native <details>, so it works without JavaScript             */}
      {/* ---------------------------------------------------------------- */}
      <section id="faq" className="container-page scroll-mt-24 pb-16">
        <SectionHeading title={t.home.faqTitle} />
        <div className="space-y-2.5">
          {faqs.map((faq) => (
            <details
              key={faq.q}
              className="group rounded-[var(--radius)] border border-line bg-surface px-5 py-4"
            >
              <summary className="cursor-pointer list-none font-semibold text-ink marker:hidden">
                <span className="flex items-center justify-between gap-4">
                  {faq.q}
                  <span
                    className="shrink-0 text-ink-muted transition-transform group-open:rotate-45"
                    aria-hidden="true"
                  >
                    +
                  </span>
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-ink-muted">{faq.a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}

/**
 * Restaurant + FAQ structured data (docs/PRD.md §51).
 *
 * Built from the restaurant row rather than hardcoded, so it stays truthful
 * when the owner edits their address or hours in the admin panel.
 */
function StructuredData({
  locale,
  restaurant,
  faqs,
}: {
  locale: "ar" | "en";
  restaurant: Awaited<ReturnType<typeof getRestaurant>>;
  faqs: { q: string; a: string }[];
}) {
  const graph = [
    {
      "@type": "Restaurant",
      "@id": `${absoluteUrl("/")}#restaurant`,
      name: pick(locale, restaurant.nameAr, restaurant.name),
      description: pick(locale, restaurant.aboutAr, restaurant.aboutEn) ?? undefined,
      url: absoluteUrl("/"),
      servesCuisine: ["Pizza", "Fast Food"],
      priceRange: "$$",
      image: absoluteUrl("/menu/pizza-special.svg"),
      telephone: restaurant.phone ?? undefined,
      email: restaurant.email ?? undefined,
      hasMenu: absoluteUrl("/menu"),
      currenciesAccepted: restaurant.currency,
      address: {
        "@type": "PostalAddress",
        streetAddress: pick(locale, restaurant.addressAr, restaurant.addressEn) ?? undefined,
        addressLocality: restaurant.city ?? undefined,
        addressCountry: "YE",
      },
      geo:
        restaurant.latitude != null && restaurant.longitude != null
          ? { "@type": "GeoCoordinates", latitude: restaurant.latitude, longitude: restaurant.longitude }
          : undefined,
      openingHours: toSchemaOpeningHours(restaurant.businessHours),
      // Deliberately unset. This used to say `false`, but the restaurant's own
      // Instagram bio reads "for orders and reservations" — so false was a claim
      // its owner contradicts. It is not `true` either: this site has no booking
      // flow, and `true` invites Google to look for one.
      potentialAction: {
        "@type": "OrderAction",
        target: { "@type": "EntryPoint", urlTemplate: absoluteUrl("/menu") },
        deliveryMethod: "http://purl.org/goodrelations/v1#PickUp",
      },
    },
    {
      "@type": "FAQPage",
      "@id": `${absoluteUrl("/")}#faq`,
      mainEntity: faqs.map((faq) => ({
        "@type": "Question",
        name: faq.q,
        acceptedAnswer: { "@type": "Answer", text: faq.a },
      })),
    },
  ];

  return (
    <script
      type="application/ld+json"
      // Values come from our own database, and JSON.stringify escapes them;
      // the only risk would be a literal "</script>" inside restaurant text.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(
          /</g,
          "\\u003c"
        ),
      }}
    />
  );
}
