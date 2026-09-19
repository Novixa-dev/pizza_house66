import { getLocale } from "@/lib/i18n/locale";
import { getRestaurant } from "@/server/restaurant";
import { CheckoutForm } from "@/components/checkout-form";

export default async function CheckoutPage() {
  const locale = await getLocale();
  const restaurant = await getRestaurant();

  const enabledMethods = restaurant.paymentMethods
    .filter((m) => m.enabled)
    .map((m) => m.type);

  return (
    <CheckoutForm
      locale={locale}
      currency={restaurant.currency}
      onlineOrderingPaused={restaurant.onlineOrderingPaused}
      pauseMessage={locale === "ar" ? restaurant.pauseMessageAr : restaurant.pauseMessageEn}
      enabledPaymentMethods={enabledMethods}
    />
  );
}
