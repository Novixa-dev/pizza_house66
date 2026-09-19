"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart, lineTotalMinor } from "./cart-context";
import { formatMoney } from "@/lib/money";
import { getDictionary, type Locale } from "@/lib/i18n/dictionaries";
import type { PaymentMethodType } from "@prisma/client";

export function CheckoutForm({
  locale,
  currency,
  onlineOrderingPaused,
  pauseMessage,
  enabledPaymentMethods,
}: {
  locale: Locale;
  currency: string;
  onlineOrderingPaused: boolean;
  pauseMessage: string | null;
  enabledPaymentMethods: PaymentMethodType[];
}) {
  const t = getDictionary(locale);
  const router = useRouter();
  const { items, subtotalMinor, clear } = useCart();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pickupMode, setPickupMode] = useState<"ASAP" | "SCHEDULED">("ASAP");
  const [pickupTime, setPickupTime] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>(
    enabledPaymentMethods[0] ?? "PAY_AT_PICKUP"
  );
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [idempotencyKey] = useState(() => crypto.randomUUID());

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-muted">{t.cart.empty}</p>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);

    const payload = {
      idempotencyKey,
      items: items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        optionValueIds: i.options.map((o) => o.optionValueId),
        note: i.note,
      })),
      customer: { name, phone },
      pickup:
        pickupMode === "ASAP"
          ? { mode: "ASAP" as const }
          : { mode: "SCHEDULED" as const, requestedAt: new Date(pickupTime).toISOString() },
      payment:
        paymentMethod === "BANK_TRANSFER"
          ? { method: "BANK_TRANSFER" as const, referenceNumber }
          : { method: "PAY_AT_PICKUP" as const },
      notes: notes.trim() || undefined,
    };

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "ORDERING_PAUSED") {
          setError(t.checkout.orderingPaused);
        } else if (data.error === "INVALID_PICKUP_TIME" || data.error === "SLOT_FULL") {
          const earliest = new Date(data.earliestValid ?? data.suggestedAt);
          setError(`${t.checkout.invalidPickup} ${earliest.toLocaleString(locale === "ar" ? "ar-YE" : "en-US")}`);
        } else {
          setError(data.message ?? "Something went wrong. Please try again.");
        }
        setSubmitting(false);
        return;
      }
      clear();
      router.push(`/order/${data.trackingToken}`);
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  if (onlineOrderingPaused) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="rounded-lg bg-brand/10 p-4 font-semibold text-brand">
          {pauseMessage ?? t.checkout.orderingPaused}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-xl space-y-8 px-4 py-10">
      <h1 className="text-2xl font-bold">{t.checkout.title}</h1>

      <fieldset className="space-y-3">
        <legend className="mb-2 font-semibold">{t.checkout.yourInfo}</legend>
        <input
          required
          minLength={2}
          placeholder={t.checkout.name}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-border bg-surface p-3"
        />
        <input
          required
          minLength={6}
          type="tel"
          placeholder={t.checkout.phone}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded-lg border border-border bg-surface p-3"
        />
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-2 font-semibold">{t.checkout.pickup}</legend>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={pickupMode === "ASAP"}
            onChange={() => setPickupMode("ASAP")}
          />
          {t.checkout.pickupAsap}
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={pickupMode === "SCHEDULED"}
            onChange={() => setPickupMode("SCHEDULED")}
          />
          {t.checkout.pickupScheduled}
        </label>
        {pickupMode === "SCHEDULED" && (
          <input
            required
            type="datetime-local"
            value={pickupTime}
            onChange={(e) => setPickupTime(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface p-3"
          />
        )}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-2 font-semibold">{t.checkout.payment}</legend>
        {enabledPaymentMethods.includes("PAY_AT_PICKUP") && (
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={paymentMethod === "PAY_AT_PICKUP"}
              onChange={() => setPaymentMethod("PAY_AT_PICKUP")}
            />
            {t.checkout.payAtPickup}
          </label>
        )}
        {enabledPaymentMethods.includes("BANK_TRANSFER") && (
          <>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={paymentMethod === "BANK_TRANSFER"}
                onChange={() => setPaymentMethod("BANK_TRANSFER")}
              />
              {t.checkout.bankTransfer}
            </label>
            {paymentMethod === "BANK_TRANSFER" && (
              <input
                required
                placeholder={t.checkout.transferReference}
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface p-3"
              />
            )}
          </>
        )}
      </fieldset>

      <textarea
        placeholder={t.checkout.notes}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        maxLength={300}
        rows={2}
        className="w-full rounded-lg border border-border bg-surface p-3"
      />

      <div className="flex items-center justify-between border-t border-border pt-4 text-lg font-bold">
        <span>{t.cart.subtotal}</span>
        <span>{formatMoney(subtotalMinor, currency, locale)}</span>
      </div>

      <ul className="text-sm text-muted">
        {items.map((i) => (
          <li key={i.cartLineId} className="flex justify-between">
            <span>
              {i.quantity}× {locale === "ar" ? i.nameAr : i.nameEn}
            </span>
            <span>{formatMoney(lineTotalMinor(i), currency, locale)}</span>
          </li>
        ))}
      </ul>

      {error && <p className="rounded-lg bg-brand/10 p-3 text-sm font-semibold text-brand">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-brand px-6 py-3 font-bold text-brand-contrast disabled:opacity-60"
      >
        {submitting ? t.checkout.submitting : t.checkout.placeOrder}
      </button>
    </form>
  );
}
