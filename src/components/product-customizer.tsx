"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "./cart-context";
import { trackClient } from "./analytics-tracker";
import { formatMoney, formatMoneyDelta } from "@/lib/money";
import { getDictionary, type Locale } from "@/lib/i18n/dictionaries";
import { Button, Field, Textarea } from "./ui";
import { CheckIcon, MinusIcon, PlusIcon } from "./ui/icons";

interface OptionValue {
  id: string;
  nameAr: string;
  nameEn: string;
  priceDeltaMinor: number;
  available: boolean;
}

interface OptionGroup {
  id: string;
  nameAr: string;
  nameEn: string;
  required: boolean;
  multiSelect: boolean;
  maxSelect: number | null;
  values: OptionValue[];
}

interface ProductForCustomizer {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  imageUrl: string | null;
  basePriceMinor: number;
  optionGroups: OptionGroup[];
}

const MAX_QUANTITY = 20;

/**
 * Product customization.
 *
 * The running total shown here is a preview only — `createOrder` recomputes
 * every figure from the database before an order exists, so a tampered price
 * in this component buys nothing (docs/PRD.md §43).
 */
export function ProductCustomizer({
  product,
  locale,
  currency,
}: {
  product: ProductForCustomizer;
  locale: Locale;
  currency: string;
}) {
  const t = getDictionary(locale);
  const router = useRouter();
  const { addItem } = useCart();

  // Required single-select groups start on their first available value so the
  // page opens in a valid, orderable state rather than with a disabled button.
  const [selected, setSelected] = useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = {};
    for (const group of product.optionGroups) {
      const firstAvailable = group.values.find((value) => value.available);
      initial[group.id] =
        group.required && !group.multiSelect && firstAvailable ? [firstAvailable.id] : [];
    }
    return initial;
  });
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [justAdded, setJustAdded] = useState(false);

  const selectedValues = useMemo(() => {
    const values: { group: OptionGroup; value: OptionValue }[] = [];
    for (const group of product.optionGroups) {
      for (const id of selected[group.id] ?? []) {
        const value = group.values.find((candidate) => candidate.id === id);
        if (value) values.push({ group, value });
      }
    }
    return values;
  }, [selected, product.optionGroups]);

  const unitPrice =
    product.basePriceMinor +
    selectedValues.reduce((sum, entry) => sum + entry.value.priceDeltaMinor, 0);
  const total = unitPrice * quantity;

  const missingRequired = product.optionGroups.filter(
    (group) => group.required && (selected[group.id] ?? []).length === 0
  );
  const canAdd = missingRequired.length === 0;

  function toggleValue(group: OptionGroup, valueId: string) {
    setJustAdded(false);
    setSelected((previous) => {
      const current = previous[group.id] ?? [];
      if (!group.multiSelect) {
        return { ...previous, [group.id]: [valueId] };
      }
      if (current.includes(valueId)) {
        return { ...previous, [group.id]: current.filter((id) => id !== valueId) };
      }
      if (group.maxSelect !== null && current.length >= group.maxSelect) {
        return previous;
      }
      return { ...previous, [group.id]: [...current, valueId] };
    });
  }

  function handleAdd() {
    if (!canAdd) return;
    addItem({
      productId: product.id,
      slug: product.slug,
      nameAr: product.nameAr,
      nameEn: product.nameEn,
      imageUrl: product.imageUrl,
      basePriceMinor: product.basePriceMinor,
      quantity,
      options: selectedValues.map(({ group, value }) => ({
        optionValueId: value.id,
        groupNameAr: group.nameAr,
        groupNameEn: group.nameEn,
        nameAr: value.nameAr,
        nameEn: value.nameEn,
        priceDeltaMinor: value.priceDeltaMinor,
      })),
      note: note.trim() || undefined,
    });
    trackClient("add_to_cart", { productId: product.id, valueMinor: total });
    setJustAdded(true);
    router.push("/cart");
  }

  return (
    <div className="space-y-6">
      {product.optionGroups.map((group) => {
        const groupSelection = selected[group.id] ?? [];
        const atLimit =
          group.multiSelect && group.maxSelect !== null && groupSelection.length >= group.maxSelect;

        return (
          <fieldset key={group.id}>
            <legend className="mb-2 flex flex-wrap items-baseline gap-2">
              <span className="font-bold text-ink">
                {locale === "ar" ? group.nameAr : group.nameEn}
              </span>
              <span className="text-xs font-semibold text-ink-muted">
                {group.required ? `(${t.product.required})` : `(${t.common.optional})`}
                {" · "}
                {group.multiSelect ? t.product.chooseMany : t.product.chooseOne}
              </span>
            </legend>

            <div className="flex flex-wrap gap-2" role="group">
              {group.values.map((value) => {
                const isSelected = groupSelection.includes(value.id);
                const disabled = !value.available || (atLimit && !isSelected);
                return (
                  <button
                    key={value.id}
                    type="button"
                    disabled={disabled}
                    aria-pressed={isSelected}
                    onClick={() => toggleValue(group, value.id)}
                    className={`inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-pill)] border px-4 py-2 text-sm font-semibold transition-colors ${
                      isSelected
                        ? "border-brand bg-brand text-brand-ink"
                        : "border-line-strong bg-surface text-ink hover:border-brand"
                    } ${disabled ? "cursor-not-allowed opacity-45" : ""}`}
                  >
                    {isSelected ? <CheckIcon /> : null}
                    {locale === "ar" ? value.nameAr : value.nameEn}
                    {value.priceDeltaMinor !== 0 ? (
                      <span className={`numeric text-xs ${isSelected ? "" : "text-ink-muted"}`}>
                        {formatMoneyDelta(value.priceDeltaMinor, currency, locale)}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </fieldset>
        );
      })}

      <Field label={t.product.notes} htmlFor="product-note">
        <Textarea
          id="product-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={200}
          rows={2}
          placeholder={t.product.notesPlaceholder}
        />
      </Field>

      <div className="rounded-[var(--radius)] border border-line bg-surface-muted p-4">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-semibold text-ink">{t.product.quantity}</span>
          <div className="flex items-center gap-1">
            <QuantityButton
              label={t.cart.decrease}
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
            >
              <MinusIcon />
            </QuantityButton>
            <span className="numeric w-10 text-center text-lg font-bold">{quantity}</span>
            <QuantityButton
              label={t.cart.increase}
              onClick={() => setQuantity((q) => Math.min(MAX_QUANTITY, q + 1))}
              disabled={quantity >= MAX_QUANTITY}
            >
              <PlusIcon />
            </QuantityButton>
          </div>
        </div>

        <div className="mb-4 flex items-baseline justify-between border-t border-line pt-4">
          <span className="font-bold text-ink">{t.product.total}</span>
          <span data-testid="product-total" className="numeric text-xl font-extrabold text-brand">
            {formatMoney(total, currency, locale)}
          </span>
        </div>

        <Button onClick={handleAdd} disabled={!canAdd} size="lg" block>
          {justAdded ? (
            <>
              <CheckIcon /> {t.product.added}
            </>
          ) : (
            t.product.addToCart
          )}
        </Button>

        {!canAdd ? (
          <p className="mt-2 text-center text-xs font-semibold text-danger" role="status">
            {t.product.chooseOne}:{" "}
            {missingRequired.map((g) => (locale === "ar" ? g.nameAr : g.nameEn)).join("، ")}
          </p>
        ) : null}
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
      className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-pill)] border border-line-strong bg-surface text-ink transition-colors hover:bg-page-elevated disabled:opacity-40"
    >
      {children}
    </button>
  );
}
