import { notFound } from "next/navigation";
import { getLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getOrderByTrackingToken } from "@/server/orders";
import { getRestaurant } from "@/server/restaurant";
import { formatMoney } from "@/lib/money";
import { CUSTOMER_VISIBLE_LABELS } from "@/lib/order-state";

export default async function OrderTrackingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const locale = await getLocale();
  const t = getDictionary(locale);
  const restaurant = await getRestaurant();

  const order = await getOrderByTrackingToken(token);
  if (!order) notFound();

  const label = CUSTOMER_VISIBLE_LABELS[order.status];

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold">{t.orderStatus.title}</h1>

      <div className="mb-6 rounded-xl border border-border bg-surface p-6 text-center">
        <p className="text-sm text-muted">{t.orderStatus.reference}</p>
        <p className="mb-4 text-2xl font-extrabold text-brand">{order.reference}</p>
        <span className="inline-block rounded-full bg-accent/10 px-4 py-2 font-semibold text-accent">
          {locale === "ar" ? label.ar : label.en}
        </span>
      </div>

      <dl className="mb-6 space-y-2 rounded-xl border border-border bg-surface p-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted">{t.orderStatus.pickupAt}</dt>
          <dd className="font-semibold">
            {order.requestedPickupAt.toLocaleString(locale === "ar" ? "ar-YE" : "en-US")}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">{t.orderStatus.total}</dt>
          <dd className="font-semibold">{formatMoney(order.totalMinor, order.currency, locale)}</dd>
        </div>
      </dl>

      <ul className="space-y-2">
        {order.items.map((item) => (
          <li key={item.id} className="rounded-lg border border-border bg-surface p-3">
            <div className="flex justify-between">
              <span className="font-semibold">
                {item.quantity}× {locale === "ar" ? item.nameAr : item.nameEn}
              </span>
              <span>{formatMoney(item.lineTotalMinor, order.currency, locale)}</span>
            </div>
            {item.options.length > 0 && (
              <p className="text-sm text-muted">
                {item.options.map((o) => (locale === "ar" ? o.nameAr : o.nameEn)).join("، ")}
              </p>
            )}
          </li>
        ))}
      </ul>

      {restaurant.whatsapp && (
        <a
          href={`https://wa.me/${restaurant.whatsapp.replace(/[^\d]/g, "")}`}
          className="mt-6 block rounded-lg border border-accent px-6 py-3 text-center font-semibold text-accent"
        >
          {t.common.whatsapp}
        </a>
      )}
    </div>
  );
}
