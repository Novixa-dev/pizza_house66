"use client";

import Link from "next/link";
import { useCart, unitPriceMinor, lineTotalMinor } from "./cart-context";
import { formatMoney } from "@/lib/money";
import { getDictionary, type Locale } from "@/lib/i18n/dictionaries";

export function CartView({ locale, currency }: { locale: Locale; currency: string }) {
  const t = getDictionary(locale);
  const { items, removeItem, setQuantity, subtotalMinor } = useCart();

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="mb-4 text-2xl font-bold">{t.cart.title}</h1>
        <p className="mb-6 text-muted">{t.cart.empty}</p>
        <Link href="/menu" className="rounded-lg bg-brand px-6 py-3 font-bold text-brand-contrast">
          {t.common.viewMenu}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold">{t.cart.title}</h1>
      <ul className="space-y-4">
        {items.map((item) => (
          <li key={item.cartLineId} className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{locale === "ar" ? item.nameAr : item.nameEn}</p>
                {item.options.length > 0 && (
                  <p className="text-sm text-muted">
                    {item.options.map((o) => (locale === "ar" ? o.nameAr : o.nameEn)).join("، ")}
                  </p>
                )}
                {item.note && <p className="text-xs italic text-muted">“{item.note}”</p>}
              </div>
              <p className="whitespace-nowrap font-bold">
                {formatMoney(lineTotalMinor(item), currency, locale)}
              </p>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQuantity(item.cartLineId, item.quantity - 1)}
                  className="h-8 w-8 rounded-full border border-border"
                >
                  −
                </button>
                <span className="w-6 text-center">{item.quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity(item.cartLineId, item.quantity + 1)}
                  className="h-8 w-8 rounded-full border border-border"
                >
                  +
                </button>
              </div>
              <button
                type="button"
                onClick={() => removeItem(item.cartLineId)}
                className="text-sm text-brand hover:underline"
              >
                {t.cart.remove}
              </button>
            </div>
            <p className="mt-1 text-xs text-muted">
              {formatMoney(unitPriceMinor(item), currency, locale)} × {item.quantity}
            </p>
          </li>
        ))}
      </ul>

      <div className="mt-8 flex items-center justify-between border-t border-border pt-4 text-lg font-bold">
        <span>{t.cart.subtotal}</span>
        <span>{formatMoney(subtotalMinor, currency, locale)}</span>
      </div>

      <Link
        href="/checkout"
        className="mt-6 block rounded-lg bg-brand px-6 py-3 text-center font-bold text-brand-contrast"
      >
        {t.cart.proceedToCheckout}
      </Link>
    </div>
  );
}
