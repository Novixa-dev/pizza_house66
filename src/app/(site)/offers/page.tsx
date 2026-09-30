import type { Metadata } from "next";
import { getLocale, pick } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getRestaurant } from "@/server/restaurant";
import { publicOffers } from "@/server/coupons";
import { LOYALTY_MILESTONE } from "@/lib/loyalty";
import { Card, EmptyState, SectionHeading } from "@/components/ui";
import { CouponCard, type CouponCardData } from "@/components/coupon-card";
import { CouponLookup } from "@/components/coupon-lookup";
import { StarIcon, TagIcon } from "@/components/ui/icons";
import { buildMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = getDictionary(locale);
  return buildMetadata({
    title: t.offers.title,
    description: t.offers.subtitle,
    path: "/offers",
    locale,
  });
}

export const dynamic = "force-dynamic";

export default async function OffersPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const [restaurant, offers] = await Promise.all([getRestaurant(), publicOffers()]);

  const coupons: CouponCardData[] = offers
    .filter((offer): offer is typeof offer & { code: string } => Boolean(offer.code))
    .map((offer) => ({
      code: offer.code,
      name: pick(locale, offer.nameAr, offer.nameEn),
      description: pick(locale, offer.descriptionAr, offer.descriptionEn),
      discountType: offer.discountType,
      discountValue: offer.discountValue,
      minOrderMinor: offer.minOrderMinor,
      maxDiscountMinor: offer.maxDiscountMinor,
      currency: restaurant.currency,
      endsAt: offer.endsAt ? offer.endsAt.toISOString() : null,
      oncePerCustomer: offer.perCustomerLimit === 1,
      appliesTo: offer.products.map((entry) =>
        pick(locale, entry.product.nameAr, entry.product.nameEn)
      ),
    }));

  const steps = [
    { title: t.offers.howStep1Title, body: t.offers.howStep1Body },
    { title: t.offers.howStep2Title, body: t.offers.howStep2Body },
    { title: t.offers.howStep3Title, body: t.offers.howStep3Body },
  ];

  return (
    <div className="container-page max-w-4xl py-10">
      <SectionHeading level={1} title={t.offers.title} subtitle={t.offers.subtitle} />

      {coupons.length === 0 ? (
        <EmptyState icon={<TagIcon />} title={t.offers.none} description={t.offers.noneHint} />
      ) : (
        <ul className="space-y-3">
          {coupons.map((coupon) => (
            <CouponCard key={coupon.code} coupon={coupon} locale={locale} />
          ))}
        </ul>
      )}

      {/* The customer asked what a coupon *is* and how it reaches them, so the
          page answers it rather than assuming. */}
      <section className="mt-14">
        <SectionHeading title={t.offers.howTitle} />
        <ol className="grid gap-4 sm:grid-cols-3">
          {steps.map((step, index) => (
            <Card as="li" key={step.title} className="p-5">
              <span className="numeric mb-3 inline-flex size-9 items-center justify-center rounded-full bg-brand-soft font-extrabold text-brand">
                {index + 1}
              </span>
              <h3 className="font-bold text-ink">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{step.body}</p>
            </Card>
          ))}
        </ol>
      </section>

      <section className="mt-14">
        <SectionHeading title={t.offers.loyaltyTitle} />
        <Card className="p-5 sm:p-6">
          <p className="flex items-start gap-3 text-ink-soft">
            <StarIcon className="mt-1 shrink-0 text-xl text-gold" />
            <span>{t.offers.loyaltyBody}</span>
          </p>

          {/* An empty five-step bar, so the scheme is legible before anyone
              has ordered anything at all. */}
          <div className="mt-5 flex gap-1.5" aria-hidden="true">
            {Array.from({ length: LOYALTY_MILESTONE }, (_, step) => (
              <span key={step} className="h-2 flex-1 rounded-full bg-line" />
            ))}
          </div>

          <div className="mt-8 border-t border-line pt-6">
            <h3 className="font-bold text-ink">{t.offers.myCoupons}</h3>
            <p className="mb-4 mt-1 text-sm text-ink-muted">{t.offers.checkCouponsHint}</p>
            <CouponLookup locale={locale} currency={restaurant.currency} />
          </div>
        </Card>
      </section>

      <section className="mt-14">
        <SectionHeading title={t.offers.whyTitle} />
        <p className="max-w-2xl leading-relaxed text-ink-soft">{t.offers.whyBody}</p>
      </section>
    </div>
  );
}
