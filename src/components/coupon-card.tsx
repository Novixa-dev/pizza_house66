"use client";

import { useState } from "react";
import Link from "next/link";
import type { Locale } from "@/lib/i18n/dictionaries";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { formatMoney } from "@/lib/money";
import { Badge, Card } from "./ui";
import { CheckIcon, TagIcon } from "./ui/icons";

export interface CouponCardData {
  code: string;
  name: string;
  description: string | null;
  discountType: "PERCENTAGE" | "FIXED";
  discountValue: number;
  minOrderMinor: number;
  maxDiscountMinor: number | null;
  currency: string;
  endsAt: string | null;
  oncePerCustomer: boolean;
  appliesTo: string[];
  /** Set for a coupon issued to one person, so the card can say so. */
  milestone?: number | null;
  state?: "available" | "used" | "expired";
}

/**
 * One offer, with its code and the conditions that decide whether it pays.
 *
 * The headline is the discount, not the name: a customer scanning this page
 * is deciding whether the code is worth the tap, and "10%" answers that where
 * "Family deal" does not. The conditions sit under it in full, because the
 * fastest way to make a coupon feel like a trick is to reveal the minimum
 * spend at checkout.
 */
export function CouponCard({ coupon, locale }: { coupon: CouponCardData; locale: Locale }) {
  const t = getDictionary(locale);
  const [copied, setCopied] = useState(false);
  const state = coupon.state ?? "available";
  const spent = state !== "available";

  async function copy() {
    try {
      await navigator.clipboard.writeText(coupon.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // Not available outside a secure context; the code is on screen.
    }
  }

  const headline =
    coupon.discountType === "PERCENTAGE"
      ? `${coupon.discountValue}%`
      : formatMoney(coupon.discountValue, coupon.currency, locale);

  const endsAt = coupon.endsAt
    ? new Intl.DateTimeFormat(locale === "ar" ? "ar-YE" : "en-GB", {
        dateStyle: "medium",
        timeZone: "Asia/Aden",
      }).format(new Date(coupon.endsAt))
    : null;

  return (
    <Card
      as="li"
      className={`relative overflow-hidden p-0 ${spent ? "opacity-60" : ""}`}
    >
      {/* The notch down the side is what makes it read as a torn-off ticket
          rather than another content card. Purely decorative. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 start-[6.5rem] hidden w-0 border-s-2 border-dashed border-line sm:block"
      />

      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-6">
        <div className="flex shrink-0 items-center gap-2 sm:w-24 sm:flex-col sm:items-start sm:gap-0">
          <p className="numeric text-3xl font-extrabold leading-none text-brand">{headline}</p>
          <p className="text-xs font-semibold text-ink-muted">
            {coupon.discountType === "PERCENTAGE" ? t.cart.discount : t.cart.discount}
          </p>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-ink">{coupon.name}</h3>
            {state === "used" ? <Badge tone="neutral">{t.offers.couponUsed}</Badge> : null}
            {state === "expired" ? <Badge tone="danger">{t.offers.couponExpired}</Badge> : null}
            {coupon.oncePerCustomer && state === "available" ? (
              <Badge tone="info">{t.offers.oncePerCustomer}</Badge>
            ) : null}
            {coupon.milestone ? (
              <Badge tone="success">
                {t.offers.couponEarnedAt.replace("{milestone}", String(coupon.milestone))}
              </Badge>
            ) : null}
          </div>

          {coupon.description ? (
            <p className="mt-1 text-sm text-ink-muted">{coupon.description}</p>
          ) : null}

          <ul className="numeric mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
            {coupon.minOrderMinor > 0 ? (
              <li>
                {t.offers.minOrder}: {formatMoney(coupon.minOrderMinor, coupon.currency, locale)}
              </li>
            ) : null}
            {coupon.maxDiscountMinor ? (
              <li>
                {t.offers.maxDiscount}:{" "}
                {formatMoney(coupon.maxDiscountMinor, coupon.currency, locale)}
              </li>
            ) : null}
            <li>
              {t.offers.appliesTo}:{" "}
              {coupon.appliesTo.length > 0 ? coupon.appliesTo.join("، ") : t.offers.wholeOrder}
            </li>
            {endsAt ? (
              <li>
                {coupon.milestone ? t.offers.couponExpires : t.offers.endsOn}: {endsAt}
              </li>
            ) : null}
          </ul>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:items-stretch">
          <button
            type="button"
            onClick={copy}
            disabled={spent}
            aria-label={`${t.offers.copy} ${coupon.code}`}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-sm)] border-2 border-dashed border-brand/50 bg-brand-soft px-4 font-extrabold tracking-wider text-brand transition-colors hover:bg-brand/10 disabled:cursor-not-allowed disabled:border-line disabled:bg-surface-muted disabled:text-ink-muted"
          >
            {copied ? <CheckIcon /> : <TagIcon />}
            <span className="numeric">{copied ? t.offers.copied : coupon.code}</span>
          </button>
          {!spent ? (
            <Link
              href="/menu"
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-sm)] px-4 text-sm font-semibold text-ink-soft hover:text-brand"
            >
              {t.offers.useIt}
            </Link>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
