import { getLocale } from "@/lib/i18n/locale";
import { getRestaurant } from "@/server/restaurant";
import { CartView } from "@/components/cart-view";

export default async function CartPage() {
  const locale = await getLocale();
  const restaurant = await getRestaurant();
  return <CartView locale={locale} currency={restaurant.currency} />;
}
