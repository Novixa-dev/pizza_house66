"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { Locale } from "@/lib/i18n/dictionaries";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { lookupCouponsAction, type CouponLookupState } from "@/server/public-actions";
import { CouponCard, type CouponCardData } from "./coupon-card";
import { Alert, Button, Field, Input } from "./ui";
import { AlertIcon, SearchIcon, StarIcon } from "./ui/icons";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <SearchIcon />
      {label}
    </Button>
  );
}

/**
 * "Show me my coupons" — a phone number in, and whatever has been issued to
 * it comes back, along with how close the next reward is.
 *
 * The progress bar is the part that earns its place. A coupon already in hand
 * is worth one discount; "one more order until the next one" is worth the
 * next order, which is the whole point of the scheme.
 */
export function CouponLookup({ locale, currency }: { locale: Locale; currency: string }) {
  const t = getDictionary(locale);
  const [state, formAction] = useActionState<CouponLookupState, FormData>(
    lookupCouponsAction,
    {}
  );

  const message =
    state.error === "rate_limited"
      ? t.track.lookupRateLimited
      : state.error === "invalid"
        ? t.track.lookupInvalid
        : null;

  const coupons: CouponCardData[] = (state.coupons ?? []).map((coupon) => ({
    code: coupon.code,
    name: locale === "ar" ? coupon.nameAr : coupon.nameEn,
    description: locale === "ar" ? coupon.descriptionAr : coupon.descriptionEn,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    minOrderMinor: coupon.minOrderMinor,
    maxDiscountMinor: coupon.maxDiscountMinor,
    currency,
    endsAt: coupon.expiresAt ? new Date(coupon.expiresAt).toISOString() : null,
    oncePerCustomer: true,
    appliesTo: [],
    milestone: coupon.milestone,
    state: coupon.redeemedAt
      ? "used"
      : coupon.expiresAt && new Date(coupon.expiresAt) < new Date()
        ? "expired"
        : "available",
  }));

  const standing = state.standing;

  return (
    <div className="space-y-6">
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <Field label={t.track.phone} htmlFor="coupon-phone" className="min-w-[14rem] flex-1">
          <Input
            id="coupon-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            required
            maxLength={20}
            autoComplete="tel"
            dir="ltr"
            defaultValue={state.phone}
            placeholder={t.track.phonePlaceholder}
          />
        </Field>
        <div className="pb-1">
          <SubmitButton label={t.offers.checkCoupons} />
        </div>
      </form>

      {message ? (
        <Alert tone="danger" icon={<AlertIcon />}>
          {message}
        </Alert>
      ) : null}

      {standing ? (
        <div className="rounded-[var(--radius)] border border-line bg-surface-muted p-4">
          <p className="flex items-center gap-2 font-bold text-ink">
            <StarIcon className="text-gold" />
            {t.offers.loyaltyTitle}
          </p>
          <p className="numeric mt-1 text-sm text-ink-soft">
            {t.offers.loyaltyProgress
              .replace("{completed}", String(standing.towardsNext))
              .replace("{milestone}", String(standing.milestone))}
            {" — "}
            {t.offers.loyaltyRemaining.replace("{remaining}", String(standing.remaining))}
          </p>
          {/* A bar rather than a number alone: five steps is a distance
              someone can see themselves crossing. */}
          <div
            className="mt-3 flex gap-1.5"
            role="img"
            aria-label={t.offers.loyaltyRemaining.replace(
              "{remaining}",
              String(standing.remaining)
            )}
          >
            {Array.from({ length: standing.milestone }, (_, step) => (
              <span
                key={step}
                className={`h-2 flex-1 rounded-full ${
                  step < standing.towardsNext ? "bg-brand" : "bg-line"
                }`}
              />
            ))}
          </div>
        </div>
      ) : null}

      {state.searched && coupons.length === 0 ? (
        <p className="text-sm text-ink-muted">{t.offers.noCoupons}</p>
      ) : null}

      {coupons.length > 0 ? (
        <ul className="space-y-3">
          {coupons.map((coupon) => (
            <CouponCard key={coupon.code} coupon={coupon} locale={locale} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}
