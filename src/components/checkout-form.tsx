"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PaymentMethodType } from "@prisma/client";
import { useCart, lineTotalMinor } from "./cart-context";
import { trackClient } from "./analytics-tracker";
import { formatMoney } from "@/lib/money";
import { getDictionary, type Locale } from "@/lib/i18n/dictionaries";
import { Alert, Button, ButtonLink, Card, EmptyState, Field, Input, SectionHeading, Textarea } from "./ui";
import { AlertIcon, CartIcon, CheckIcon, ClockIcon, ReceiptIcon, TagIcon } from "./ui/icons";

export interface PickupSlot {
  value: string; // ISO instant
  label: string;
  remaining: number;
}

export interface PickupDay {
  key: string;
  label: string;
  slots: PickupSlot[];
}

export interface PaymentOption {
  type: PaymentMethodType;
  label: string;
  instructions: string | null;
}

const RECEIPT_MAX_BYTES = 3 * 1024 * 1024;
const RECEIPT_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Checkout.
 *
 * Three things here are load-bearing:
 *
 *  - The pickup picker only offers slots the server generated, so "choose a
 *    valid pickup time" is enforced by construction rather than by validating
 *    a free-text timestamp after the fact (docs/PRD.md §12.3, §70).
 *  - The idempotency key is generated once per mounted form. Double-clicking
 *    "Place order" — or a retry after a flaky connection — reaches the server
 *    with the same key and returns the same order (docs/PRD.md §45, §92.I).
 *  - Nothing about price is sent. The server re-prices the basket from the
 *    database and its answer is the one that counts (docs/PRD.md §43).
 */
export function CheckoutForm({
  locale,
  currency,
  minOrderMinor,
  orderingPaused,
  pauseMessage,
  paymentMethods,
  pickupDays,
  defaultPrepMinutes,
  bankDetails,
}: {
  locale: Locale;
  currency: string;
  minOrderMinor: number;
  orderingPaused: boolean;
  pauseMessage: string | null;
  paymentMethods: PaymentOption[];
  pickupDays: PickupDay[];
  defaultPrepMinutes: number;
  bankDetails: { bankName: string | null; account: string | null; holder: string | null };
}) {
  const t = getDictionary(locale);
  const router = useRouter();
  const { items, subtotalMinor, clear, hydrated } = useCart();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pickupMode, setPickupMode] = useState<"ASAP" | "SCHEDULED">("ASAP");
  const [selectedDay, setSelectedDay] = useState(pickupDays[0]?.key ?? "");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>(
    paymentMethods[0]?.type ?? "PAY_AT_PICKUP"
  );
  const [referenceNumber, setReferenceNumber] = useState("");
  const [receipt, setReceipt] = useState<{ name: string; dataBase64: string; contentType: string } | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [promo, setPromo] = useState<{ code: string; discountMinor: number; label: string } | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoChecking, setPromoChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; phone?: string; slot?: string; reference?: string }>({});

  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const checkoutTracked = useRef(false);

  useEffect(() => {
    if (!checkoutTracked.current && hydrated && items.length > 0) {
      checkoutTracked.current = true;
      trackClient("checkout_started", { valueMinor: subtotalMinor });
    }
  }, [hydrated, items.length, subtotalMinor]);

  const activeDay = useMemo(
    () => pickupDays.find((day) => day.key === selectedDay) ?? pickupDays[0],
    [pickupDays, selectedDay]
  );

  const discountMinor = promo?.discountMinor ?? 0;
  const totalMinor = Math.max(0, subtotalMinor - discountMinor);

  if (!hydrated) {
    return (
      <div className="container-page py-10">
        <div className="skeleton h-96 rounded-[var(--radius)]" />
      </div>
    );
  }

  if (orderingPaused) {
    return (
      <div className="container-page py-16">
        <SectionHeading level={1} title={t.checkout.title} />
        <Alert tone="warning" icon={<AlertIcon />} title={t.checkout.orderingPaused}>
          {pauseMessage}
        </Alert>
        <div className="mt-6">
          <ButtonLink href="/menu" variant="secondary">
            {t.common.backToMenu}
          </ButtonLink>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="container-page py-16">
        <SectionHeading level={1} title={t.checkout.title} />
        <EmptyState
          title={t.cart.empty}
          description={t.cart.emptyHint}
          icon={<CartIcon />}
          action={<ButtonLink href="/menu">{t.common.viewMenu}</ButtonLink>}
        />
      </div>
    );
  }

  function cartPayload() {
    return items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      optionValueIds: item.options.map((option) => option.optionValueId),
      note: item.note,
    }));
  }

  async function handleReceiptChange(file: File | null) {
    setReceiptError(null);
    if (!file) {
      setReceipt(null);
      return;
    }
    if (!RECEIPT_TYPES.includes(file.type)) {
      setReceiptError(t.checkout.receiptWrongType);
      setReceipt(null);
      return;
    }
    if (file.size > RECEIPT_MAX_BYTES) {
      setReceiptError(t.checkout.receiptTooLarge);
      setReceipt(null);
      return;
    }
    const buffer = await file.arrayBuffer();
    // Chunked conversion: a 3MB spread into String.fromCharCode at once
    // overflows the argument limit on some browsers.
    setReceipt({
      name: file.name,
      contentType: file.type,
      dataBase64: arrayBufferToBase64(buffer),
    });
  }

  async function applyPromo() {
    const code = promoCode.trim();
    if (!code) return;
    setPromoChecking(true);
    setPromoError(null);
    try {
      const response = await fetch("/api/promotions/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, items: cartPayload() }),
      });
      const data = await response.json();
      if (!response.ok || !data.valid) {
        setPromo(null);
        setPromoError(
          data.reasonCode === "BELOW_MINIMUM" ? t.checkout.promoBelowMinimum : t.checkout.promoInvalid
        );
        return;
      }
      setPromo({
        code: code.toUpperCase(),
        discountMinor: data.discountMinor,
        label: locale === "ar" ? data.nameAr : data.nameEn,
      });
    } catch {
      setPromoError(t.checkout.promoInvalid);
    } finally {
      setPromoChecking(false);
    }
  }

  function validate(): boolean {
    const errors: typeof fieldErrors = {};
    if (name.trim().length < 2) errors.name = t.checkout.requiredField;
    if (phone.replace(/\D/g, "").length < 7) errors.phone = t.checkout.invalidPhone;
    if (pickupMode === "SCHEDULED" && !selectedSlot) errors.slot = t.checkout.requiredField;
    if (paymentMethod === "BANK_TRANSFER" && referenceNumber.trim().length < 2) {
      errors.reference = t.checkout.requiredField;
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    if (!validate()) return;

    setSubmitting(true);
    const payload = {
      idempotencyKey,
      items: cartPayload(),
      customer: { name: name.trim(), phone: phone.trim() },
      pickup:
        pickupMode === "ASAP"
          ? { mode: "ASAP" as const }
          : { mode: "SCHEDULED" as const, requestedAt: selectedSlot },
      payment:
        paymentMethod === "BANK_TRANSFER"
          ? {
              method: "BANK_TRANSFER" as const,
              referenceNumber: referenceNumber.trim(),
              receipt: receipt
                ? {
                    contentType: receipt.contentType,
                    dataBase64: receipt.dataBase64,
                    originalName: receipt.name,
                  }
                : undefined,
            }
          : { method: paymentMethod as "PAY_AT_PICKUP" },
      promoCode: promo?.code,
      notes: notes.trim() || undefined,
    };

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(errorMessageFor(data, t, locale));
        setSubmitting(false);
        // A rejected pickup time usually means someone else took the slot;
        // refreshing pulls a fresh, accurate list.
        if (data.error === "SLOT_FULL" || data.error === "INVALID_PICKUP_TIME") {
          router.refresh();
        }
        return;
      }

      trackClient("checkout_completed", { valueMinor: totalMinor });
      clear();
      router.push(`/order/${data.trackingToken}`);
    } catch {
      setError(t.checkout.networkError);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="container-page py-10">
      <SectionHeading level={1} title={t.checkout.title} />

      {/* `[&>*]:min-w-0` is load-bearing. Grid items default to
          `min-width: auto`, so a child refuses to shrink below its
          min-content width — the order summary's price rows were forcing
          this grid to 539px inside a 382px column, pushing the whole
          checkout page into horizontal scroll on a phone and shifting the
          pickup-slot buttons out from under the user's thumb.
          Caught by tests/e2e/customer-ordering.spec.ts. */}
      <div className="grid gap-8 [&>*]:min-w-0 lg:grid-cols-[1fr_22rem] lg:items-start">
        <div className="space-y-6">
          {/* ------------------------------------------------ Contact ---- */}
          <Card className="p-5">
            <h2 className="mb-4 font-bold text-ink">{t.checkout.stepContact}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t.checkout.name} htmlFor="name" required error={fieldErrors.name}>
                <Input
                  id="name"
                  name="name"
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={t.checkout.namePlaceholder}
                  aria-invalid={Boolean(fieldErrors.name)}
                />
              </Field>
              <Field label={t.checkout.phone} htmlFor="phone" required error={fieldErrors.phone}>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  dir="ltr"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder={t.checkout.phonePlaceholder}
                  aria-invalid={Boolean(fieldErrors.phone)}
                />
              </Field>
            </div>
          </Card>

          {/* ------------------------------------------------- Pickup ---- */}
          <Card className="p-5">
            <h2 className="mb-4 font-bold text-ink">{t.checkout.stepPickup}</h2>

            <div className="grid gap-3 sm:grid-cols-2">
              <ChoiceCard
                selected={pickupMode === "ASAP"}
                onSelect={() => setPickupMode("ASAP")}
                title={t.checkout.pickupAsap}
                description={`${t.checkout.pickupAsapHint} · ~${defaultPrepMinutes} ${t.common.minutes}`}
                icon={<ClockIcon />}
                name="pickup-mode"
              />
              <ChoiceCard
                selected={pickupMode === "SCHEDULED"}
                onSelect={() => setPickupMode("SCHEDULED")}
                title={t.checkout.pickupScheduled}
                description={t.checkout.pickupScheduledHint}
                icon={<ClockIcon />}
                name="pickup-mode"
                disabled={pickupDays.length === 0}
              />
            </div>

            {pickupMode === "SCHEDULED" ? (
              pickupDays.length === 0 ? (
                <div className="mt-4">
                  <Alert tone="warning" icon={<AlertIcon />}>
                    {t.checkout.noSlots}
                  </Alert>
                </div>
              ) : (
                <div className="mt-5 space-y-4">
                  <div>
                    <p className="mb-2 text-sm font-semibold text-ink">{t.checkout.chooseDay}</p>
                    <div data-testid="pickup-days" className="scroll-row flex gap-2">
                      {pickupDays.map((day) => (
                        <button
                          key={day.key}
                          type="button"
                          aria-pressed={activeDay?.key === day.key}
                          onClick={() => {
                            setSelectedDay(day.key);
                            setSelectedSlot("");
                          }}
                          className={`shrink-0 whitespace-nowrap rounded-[var(--radius-pill)] border px-4 py-2 text-sm font-bold transition-colors ${
                            activeDay?.key === day.key
                              ? "border-brand bg-brand text-brand-ink"
                              : "border-line-strong bg-surface text-ink-soft hover:bg-surface-muted"
                          }`}
                        >
                          {day.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-sm font-semibold text-ink">{t.checkout.chooseTime}</p>
                    <div data-testid="pickup-slots" className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                      {activeDay?.slots.map((slot) => (
                        <button
                          key={slot.value}
                          type="button"
                          aria-pressed={selectedSlot === slot.value}
                          onClick={() => {
                            setSelectedSlot(slot.value);
                            setFieldErrors((prev) => ({ ...prev, slot: undefined }));
                          }}
                          className={`numeric min-h-11 rounded-[var(--radius-sm)] border px-2 py-2 text-sm font-bold transition-colors ${
                            selectedSlot === slot.value
                              ? "border-brand bg-brand text-brand-ink"
                              : "border-line-strong bg-surface text-ink hover:border-brand"
                          }`}
                        >
                          {slot.label}
                        </button>
                      ))}
                    </div>
                    {fieldErrors.slot ? (
                      <p className="mt-2 text-xs font-semibold text-danger" role="alert">
                        {fieldErrors.slot}
                      </p>
                    ) : null}
                  </div>
                </div>
              )
            ) : null}
          </Card>

          {/* ------------------------------------------------ Payment ---- */}
          <Card className="p-5">
            <h2 className="mb-4 font-bold text-ink">{t.checkout.stepPayment}</h2>

            {paymentMethods.length === 0 ? (
              <Alert tone="danger" icon={<AlertIcon />}>
                {t.checkout.genericError}
              </Alert>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {paymentMethods.map((method) => (
                  <ChoiceCard
                    key={method.type}
                    selected={paymentMethod === method.type}
                    onSelect={() => setPaymentMethod(method.type)}
                    title={method.label}
                    description={method.instructions}
                    icon={method.type === "BANK_TRANSFER" ? <ReceiptIcon /> : <ClockIcon />}
                    name="payment-method"
                  />
                ))}
              </div>
            )}

            {paymentMethod === "BANK_TRANSFER" ? (
              <div className="mt-5 space-y-4 rounded-[var(--radius-sm)] border border-line bg-surface-muted p-4">
                {bankDetails.account ? (
                  <dl className="space-y-1.5 text-sm">
                    <p className="font-bold text-ink">{t.checkout.bankDetails}</p>
                    {bankDetails.bankName ? (
                      <div className="flex justify-between gap-4">
                        <dt className="text-ink-muted">{t.checkout.bankName}</dt>
                        <dd className="font-semibold text-ink">{bankDetails.bankName}</dd>
                      </div>
                    ) : null}
                    <div className="flex justify-between gap-4">
                      <dt className="text-ink-muted">{t.checkout.bankAccount}</dt>
                      <dd className="numeric font-semibold text-ink">{bankDetails.account}</dd>
                    </div>
                    {bankDetails.holder ? (
                      <div className="flex justify-between gap-4">
                        <dt className="text-ink-muted">{t.checkout.bankHolder}</dt>
                        <dd className="font-semibold text-ink">{bankDetails.holder}</dd>
                      </div>
                    ) : null}
                  </dl>
                ) : null}

                <Field
                  label={t.checkout.transferReference}
                  htmlFor="reference"
                  required
                  error={fieldErrors.reference}
                >
                  <Input
                    id="reference"
                    dir="ltr"
                    value={referenceNumber}
                    onChange={(event) => setReferenceNumber(event.target.value)}
                    placeholder={t.checkout.transferReferencePlaceholder}
                    aria-invalid={Boolean(fieldErrors.reference)}
                  />
                </Field>

                <Field
                  label={t.checkout.receipt}
                  htmlFor="receipt"
                  hint={t.checkout.receiptHint}
                  error={receiptError ?? undefined}
                >
                  <input
                    id="receipt"
                    type="file"
                    accept={RECEIPT_TYPES.join(",")}
                    onChange={(event) => void handleReceiptChange(event.target.files?.[0] ?? null)}
                    className="block w-full text-sm text-ink-soft file:me-3 file:rounded-[var(--radius-sm)] file:border-0 file:bg-brand file:px-4 file:py-2 file:text-sm file:font-semibold file:text-brand-ink"
                  />
                </Field>

                {receipt ? (
                  <p className="flex items-center gap-2 text-sm font-semibold text-accent">
                    <CheckIcon /> {t.checkout.receiptSelected}: {receipt.name}
                  </p>
                ) : null}
              </div>
            ) : null}
          </Card>

          {/* -------------------------------------------------- Notes ---- */}
          <Card className="p-5">
            <Field label={t.checkout.notes} htmlFor="notes">
              <Textarea
                id="notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                maxLength={300}
                rows={3}
                placeholder={t.checkout.notesPlaceholder}
              />
            </Field>
          </Card>
        </div>

        {/* ------------------------------------------------- Summary ---- */}
        <Card className="p-5 lg:sticky lg:top-24">
          <h2 className="mb-4 font-bold text-ink">{t.checkout.orderSummary}</h2>

          <ul className="mb-4 space-y-2 border-b border-line pb-4 text-sm">
            {items.map((item) => (
              <li key={item.cartLineId} className="flex justify-between gap-3">
                <span className="min-w-0 text-ink-soft">
                  <span className="numeric font-semibold text-ink">{item.quantity}×</span>{" "}
                  {locale === "ar" ? item.nameAr : item.nameEn}
                </span>
                <span className="numeric shrink-0 font-semibold text-ink">
                  {formatMoney(lineTotalMinor(item), currency, locale)}
                </span>
              </li>
            ))}
          </ul>

          <div className="mb-4 space-y-2 border-b border-line pb-4">
            <div className="flex gap-2">
              <Input
                value={promoCode}
                onChange={(event) => setPromoCode(event.target.value.toUpperCase())}
                placeholder={t.checkout.promoPlaceholder}
                aria-label={t.checkout.promoCode}
                dir="ltr"
                className="text-sm"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void applyPromo()}
                disabled={promoChecking || promoCode.trim().length < 2}
              >
                {t.checkout.promoApply}
              </Button>
            </div>
            {promo ? (
              <p className="flex items-center gap-1.5 text-sm font-semibold text-accent">
                <TagIcon /> {promo.label ?? t.checkout.promoApplied}
              </p>
            ) : null}
            {promoError ? (
              <p className="text-sm font-semibold text-danger" role="alert">
                {promoError}
              </p>
            ) : null}
          </div>

          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-muted">{t.cart.subtotal}</dt>
              <dd className="numeric font-semibold text-ink">
                {formatMoney(subtotalMinor, currency, locale)}
              </dd>
            </div>
            {discountMinor > 0 ? (
              <div className="flex justify-between">
                <dt className="text-accent">{t.cart.discount}</dt>
                <dd className="numeric font-semibold text-accent">
                  −{formatMoney(discountMinor, currency, locale)}
                </dd>
              </div>
            ) : null}
          </dl>

          <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
            <span className="font-extrabold text-ink">{t.cart.total}</span>
            <span className="numeric text-xl font-extrabold text-brand">
              {formatMoney(totalMinor, currency, locale)}
            </span>
          </div>

          {error ? (
            <div className="mt-4">
              <Alert tone="danger" icon={<AlertIcon />}>
                {error}
              </Alert>
            </div>
          ) : null}

          {totalMinor < minOrderMinor ? (
            <p className="mt-4 rounded-[var(--radius-sm)] bg-gold-soft p-3 text-sm font-semibold text-gold">
              {t.cart.minOrderNotice}:{" "}
              <span className="numeric">{formatMoney(minOrderMinor, currency, locale)}</span>
            </p>
          ) : (
            <Button type="submit" size="lg" block disabled={submitting} className="mt-5">
              {submitting ? t.checkout.submitting : t.checkout.placeOrder}
            </Button>
          )}
        </Card>
      </div>
    </form>
  );
}

function ChoiceCard({
  selected,
  onSelect,
  title,
  description,
  icon,
  name,
  disabled,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  description?: string | null;
  icon?: React.ReactNode;
  name: string;
  disabled?: boolean;
}) {
  // A real radio input rather than a styled button: screen readers announce
  // the group and its position, and arrow keys move between options.
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-[var(--radius)] border p-4 transition-colors ${
        selected ? "border-brand bg-brand-soft" : "border-line-strong bg-surface hover:border-brand"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <input
        type="radio"
        name={name}
        checked={selected}
        disabled={disabled}
        onChange={onSelect}
        className="mt-1 h-4 w-4 shrink-0 accent-[var(--brand)]"
      />
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 font-bold text-ink">
          {icon ? <span className="text-brand">{icon}</span> : null}
          {title}
        </span>
        {description ? (
          <span className="mt-0.5 block text-xs leading-relaxed text-ink-muted">{description}</span>
        ) : null}
      </span>
    </label>
  );
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function errorMessageFor(
  data: { error?: string; earliestValid?: string; suggestedAt?: string },
  t: ReturnType<typeof getDictionary>,
  locale: Locale
): string {
  switch (data.error) {
    case "ORDERING_PAUSED":
      return t.checkout.orderingPaused;
    case "PRODUCT_UNAVAILABLE":
      return t.checkout.productUnavailable;
    case "RATE_LIMITED":
      return t.checkout.tooManyRequests;
    case "SLOT_FULL":
      return t.checkout.slotFull;
    case "INVALID_PICKUP_TIME": {
      const suggestion = data.earliestValid ?? data.suggestedAt;
      if (!suggestion) return t.checkout.genericError;
      const when = new Date(suggestion).toLocaleString(locale === "ar" ? "ar-YE" : "en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        day: "numeric",
        month: "short",
      });
      return `${t.checkout.invalidPickup} ${when}`;
    }
    default:
      return t.checkout.genericError;
  }
}
