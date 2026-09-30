import type { Metadata } from "next";
import { getLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getRestaurant } from "@/server/restaurant";
import { SectionHeading, Card } from "@/components/ui";
import { SavedOrders } from "@/components/saved-orders";
import { OrderLookupForm } from "@/components/order-lookup-form";

export const metadata: Metadata = {
  // The page itself holds nothing private, but it is a personal view and has
  // no business in a search index.
  robots: { index: false, follow: true },
};

export const dynamic = "force-dynamic";

export default async function MyOrdersPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const restaurant = await getRestaurant();

  return (
    <div className="container-page max-w-3xl py-10">
      <SectionHeading level={1} title={t.track.title} subtitle={t.track.subtitle} />

      <SavedOrders locale={locale} timeZone={restaurant.timezone} />

      <Card className="mt-10 p-5 sm:p-6">
        <h2 className="font-bold text-ink">{t.track.lookupTitle}</h2>
        <p className="mb-5 mt-1 text-sm text-ink-muted">{t.track.lookupHint}</p>
        <OrderLookupForm locale={locale} />
      </Card>
    </div>
  );
}
