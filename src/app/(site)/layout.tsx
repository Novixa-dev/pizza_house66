import { getLocale } from "@/lib/i18n/locale";
import { getRestaurant, restaurantStatus } from "@/server/restaurant";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PageViewTracker } from "@/components/analytics-tracker";

/**
 * Shell for every customer-facing page.
 *
 * The staff areas deliberately sit outside this group: a kitchen tablet has
 * no use for the marketing footer, and the admin panel should never be able
 * to leak restaurant chrome into a print-out or a screenshot.
 */
export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  const restaurant = await getRestaurant();
  const status = restaurantStatus(restaurant);

  return (
    <>
      <SiteHeader
        locale={locale}
        isOpen={status.open}
        ordersPaused={restaurant.onlineOrderingPaused}
      />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter locale={locale} restaurant={restaurant} />
      <PageViewTracker />
    </>
  );
}
