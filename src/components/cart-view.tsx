"use client";

import Image from "next/image";
import Link from "next/link";
import { useCart, unitPriceMinor, lineTotalMinor } from "./cart-context";
import { trackClient } from "./analytics-tracker";
import { formatMoney } from "@/lib/money";
import { getDictionary, type Locale } from "@/lib/i18n/dictionaries";
import { ButtonLink, Card, EmptyState, SectionHeading } from "./ui";
import { CartIcon, MinusIcon, PizzaIcon, PlusIcon, TrashIcon } from "./ui/icons";

export function CartView({
  locale,
  currency,
  minOrderMinor,
  orderingPaused,
  pauseMessage,
}: {
  locale: Locale;
  currency: string;
  minOrderMinor: number;
  orderingPaused: boolean;
  pauseMessage: string | null;
}) {
  const t = getDictionary(locale);
  const { items, hydrated, removeItem, setQuantity, subtotalMinor } = useCart();

  // Before hydration the cart contents are unknown, so show the skeleton
  // rather than flashing "your cart is empty" at someone who has ten items.
  if (!hydrated) {
    return (
      <div className="container-page py-10">
        <SectionHeading level={1} title={t.cart.title} />
        <div className="space-y-3">
          {[0, 1].map((index) => (
            <div key={index} className="skeleton h-28 rounded-[var(--radius)]" />
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="container-page py-16">
        <SectionHeading level={1} title={t.cart.title} />
        <EmptyState
          title={t.cart.empty}
          description={t.cart.emptyHint}
          icon={<CartIcon />}
          action={<ButtonLink href="/menu">{t.common.viewMenu}</ButtonLink>}
        />
      </div>
    );
  }

  const belowMinimum = subtotalMinor < minOrderMinor;

  return (
    <div className="container-page py-10">
      <SectionHeading level={1} title={t.cart.title} />

      {/* See checkout-form.tsx — same grid, same min-width: auto trap. */}
      <div className="grid gap-8 [&>*]:min-w-0 lg:grid-cols-[1fr_22rem] lg:items-start">
        <ul className="space-y-3">
          {items.map((item) => (
            <Card as="li" key={item.cartLineId} className="p-4">
              <div className="flex gap-4">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-page-elevated">
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt=""
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xl text-ink-muted">
                      <PizzaIcon />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/product/${item.slug}`}
                        className="font-bold text-ink hover:text-brand"
                      >
                        {locale === "ar" ? item.nameAr : item.nameEn}
                      </Link>
                      {item.options.length > 0 ? (
                        <p className="mt-0.5 text-sm text-ink-muted">
                          {item.options
                            .map((option) => (locale === "ar" ? option.nameAr : option.nameEn))
                            .join(locale === "ar" ? "، " : ", ")}
                        </p>
                      ) : null}
                      {item.note ? (
                        <p className="mt-1 text-xs italic text-ink-muted">“{item.note}”</p>
                      ) : null}
                    </div>
                    <p className="numeric shrink-0 font-extrabold text-ink">
                      {formatMoney(lineTotalMinor(item), currency, locale)}
                    </p>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1">
                      <QuantityButton
                        label={t.cart.decrease}
                        onClick={() => setQuantity(item.cartLineId, item.quantity - 1)}
                        disabled={item.quantity <= 1}
                      >
                        <MinusIcon />
                      </QuantityButton>
                      <span className="numeric w-8 text-center font-bold">{item.quantity}</span>
                      <QuantityButton
                        label={t.cart.increase}
                        onClick={() => setQuantity(item.cartLineId, item.quantity + 1)}
                        disabled={item.quantity >= 20}
                      >
                        <PlusIcon />
                      </QuantityButton>
                      <span className="numeric ms-2 text-xs text-ink-muted">
                        {formatMoney(unitPriceMinor(item), currency, locale)} ×{" "}
                        {item.quantity}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        trackClient("remove_from_cart", { productId: item.productId });
                        removeItem(item.cartLineId);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2 py-1.5 text-sm font-semibold text-ink-muted transition-colors hover:bg-danger-soft hover:text-danger"
                    >
                      <TrashIcon />
                      <span className="hidden sm:inline">{t.cart.remove}</span>
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </ul>

        <Card className="p-5 lg:sticky lg:top-24">
          <h2 className="mb-4 font-bold text-ink">{t.checkout.orderSummary}</h2>
          <dl className="space-y-2 border-b border-line pb-4">
            <div className="flex justify-between text-sm">
              <dt className="text-ink-muted">{t.cart.subtotal}</dt>
              <dd className="numeric font-semibold text-ink">
                {formatMoney(subtotalMinor, currency, locale)}
              </dd>
            </div>
          </dl>
          <div className="flex items-baseline justify-between py-4">
            <span className="font-extrabold text-ink">{t.cart.total}</span>
            <span className="numeric text-xl font-extrabold text-brand">
              {formatMoney(subtotalMinor, currency, locale)}
            </span>
          </div>

          {orderingPaused ? (
            <p className="rounded-[var(--radius-sm)] bg-gold-soft p-3 text-sm font-semibold text-gold">
              {pauseMessage ?? t.checkout.orderingPaused}
            </p>
          ) : belowMinimum ? (
            <p className="rounded-[var(--radius-sm)] bg-gold-soft p-3 text-sm font-semibold text-gold">
              {t.cart.minOrderNotice}:{" "}
              <span className="numeric">{formatMoney(minOrderMinor, currency, locale)}</span>
            </p>
          ) : (
            <ButtonLink href="/checkout" size="lg" block>
              {t.cart.proceedToCheckout}
            </ButtonLink>
          )}

          <Link
            href="/menu"
            className="mt-3 block text-center text-sm font-semibold text-ink-muted hover:text-brand"
          >
            {t.cart.continueShopping}
          </Link>
        </Card>
      </div>
    </div>
  );
}

function QuantityButton({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-pill)] border border-line-strong bg-surface text-ink transition-colors hover:bg-page-elevated disabled:opacity-40"
    >
      {children}
    </button>
  );
}
