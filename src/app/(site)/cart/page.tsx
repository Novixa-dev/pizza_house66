import type { Metadata } from "next";
import { getLocale, pick } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getRestaurant } from "@/server/restaurant";
import { CartView } from "@/components/cart-view";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: getDictionary(locale).cart.title,
    // A cart is per-visitor and has nothing to index.
    robots: { index: false, follow: true },
  };
}

export default async function CartPage() {
  const locale = await getLocale();
  const restaurant = await getRestaurant();

  return (
    <CartView
      locale={locale}
      currency={restaurant.currency}
      minOrderMinor={restaurant.minOrderMinor}
      orderingPaused={restaurant.onlineOrderingPaused}
      pauseMessage={pick(locale, restaurant.pauseMessageAr, restaurant.pauseMessageEn)}
    />
  );
}
