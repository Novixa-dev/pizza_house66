import type { Metadata } from "next";
import { getLocale, pick } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { enabledPaymentMethods, getRestaurant } from "@/server/restaurant";
import { getAvailablePickupSlots } from "@/server/orders";
import { formatDate, formatTime, getZonedParts } from "@/lib/time";
import { CheckoutForm, type PickupDay, type PaymentOption } from "@/components/checkout-form";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: getDictionary(locale).checkout.title,
    robots: { index: false, follow: false },
  };
}

export default async function CheckoutPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const restaurant = await getRestaurant();

  // Slots are computed on the server against live capacity and opening hours,
  // then grouped into days for the picker. The customer can only ever select
  // something the server already agreed to (docs/PRD.md §12.3).
  const slots = restaurant.onlineOrderingPaused ? [] : await getAvailablePickupSlots();
  const days = groupSlotsByDay(slots, restaurant.timezone, locale, t.common.today, t.common.tomorrow);

  const methods: PaymentOption[] = enabledPaymentMethods(restaurant).map((method) => ({
    type: method.type,
    label: t.paymentMethod[method.type],
    instructions: pick(locale, method.instructionsAr, method.instructionsEn),
  }));

  return (
    <CheckoutForm
      locale={locale}
      currency={restaurant.currency}
      minOrderMinor={restaurant.minOrderMinor}
      orderingPaused={restaurant.onlineOrderingPaused}
      pauseMessage={pick(locale, restaurant.pauseMessageAr, restaurant.pauseMessageEn)}
      paymentMethods={methods}
      pickupDays={days}
      defaultPrepMinutes={restaurant.defaultPrepMinutes}
      bankDetails={{
        bankName: pick(locale, restaurant.bankNameAr, restaurant.bankNameEn),
        account: restaurant.bankAccount,
        holder: pick(locale, restaurant.bankHolderAr, restaurant.bankHolderEn),
      }}
    />
  );
}

function groupSlotsByDay(
  slots: { at: Date; remaining: number }[],
  timeZone: string,
  locale: "ar" | "en",
  todayLabel: string,
  tomorrowLabel: string
): PickupDay[] {
  const now = new Date();
  const todayKey = dayKey(now, timeZone);
  const tomorrowKey = dayKey(new Date(now.getTime() + 86_400_000), timeZone);

  const byDay = new Map<string, PickupDay>();
  for (const slot of slots) {
    const key = dayKey(slot.at, timeZone);
    if (!byDay.has(key)) {
      byDay.set(key, {
        key,
        label:
          key === todayKey
            ? todayLabel
            : key === tomorrowKey
              ? tomorrowLabel
              : formatDate(slot.at, timeZone, locale),
        slots: [],
      });
    }
    byDay.get(key)!.slots.push({
      value: slot.at.toISOString(),
      label: formatTime(slot.at, timeZone, locale),
      remaining: slot.remaining,
    });
  }
  return Array.from(byDay.values());
}

function dayKey(instant: Date, timeZone: string): string {
  const { year, month, day } = getZonedParts(instant, timeZone);
  return `${year}-${month}-${day}`;
}
