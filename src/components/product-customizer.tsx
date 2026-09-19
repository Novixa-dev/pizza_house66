"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "./cart-context";
import { formatMoney } from "@/lib/money";
import { getDictionary, type Locale } from "@/lib/i18n/dictionaries";

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
  values: OptionValue[];
}
interface ProductForCustomizer {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  basePriceMinor: number;
  optionGroups: OptionGroup[];
}

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

  const [selected, setSelected] = useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = {};
    for (const group of product.optionGroups) {
      if (group.required && !group.multiSelect && group.values[0]) {
        initial[group.id] = [group.values[0].id];
      } else {
        initial[group.id] = [];
      }
    }
    return initial;
  });
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [added, setAdded] = useState(false);

  const selectedValues = useMemo(() => {
    const values: OptionValue[] = [];
    for (const group of product.optionGroups) {
      for (const id of selected[group.id] ?? []) {
        const v = group.values.find((x) => x.id === id);
        if (v) values.push(v);
      }
    }
    return values;
  }, [selected, product.optionGroups]);

  const unitPrice = product.basePriceMinor + selectedValues.reduce((s, v) => s + v.priceDeltaMinor, 0);
  const total = unitPrice * quantity;

  function toggleValue(group: OptionGroup, valueId: string) {
    setSelected((prev) => {
      const current = prev[group.id] ?? [];
      if (group.multiSelect) {
        const next = current.includes(valueId)
          ? current.filter((id) => id !== valueId)
          : [...current, valueId];
        return { ...prev, [group.id]: next };
      }
      return { ...prev, [group.id]: [valueId] };
    });
  }

  function canAdd(): boolean {
    return product.optionGroups.every((g) => !g.required || (selected[g.id] ?? []).length > 0);
  }

  function handleAdd() {
    if (!canAdd()) return;
    addItem({
      productId: product.id,
      slug: product.slug,
      nameAr: product.nameAr,
      nameEn: product.nameEn,
      basePriceMinor: product.basePriceMinor,
      quantity,
      options: selectedValues.map((v) => ({
        optionValueId: v.id,
        nameAr: v.nameAr,
        nameEn: v.nameEn,
        priceDeltaMinor: v.priceDeltaMinor,
      })),
      note: note.trim() || undefined,
    });
    setAdded(true);
    setTimeout(() => router.push("/cart"), 500);
  }

  return (
    <div className="space-y-6">
      {product.optionGroups.map((group) => (
        <fieldset key={group.id} className="rounded-lg border border-border p-4">
          <legend className="px-1 font-semibold">
            {locale === "ar" ? group.nameAr : group.nameEn}
            {group.required && <span className="ms-1 text-xs text-brand">({t.product.required})</span>}
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {group.values.map((value) => {
              const isSelected = (selected[group.id] ?? []).includes(value.id);
              return (
                <button
                  key={value.id}
                  type="button"
                  disabled={!value.available}
                  onClick={() => toggleValue(group, value.id)}
                  className={`rounded-full border px-4 py-2 text-sm transition ${
                    isSelected
                      ? "border-brand bg-brand text-brand-contrast"
                      : "border-border bg-surface hover:border-brand"
                  } ${!value.available ? "cursor-not-allowed opacity-40" : ""}`}
                >
                  {locale === "ar" ? value.nameAr : value.nameEn}
                  {value.priceDeltaMinor > 0 && ` (+${formatMoney(value.priceDeltaMinor, currency, locale)})`}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}

      <div>
        <label className="mb-1 block font-semibold">{t.product.quantity}</label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="h-9 w-9 rounded-full border border-border text-lg"
          >
            −
          </button>
          <span className="w-6 text-center">{quantity}</span>
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.min(20, q + 1))}
            className="h-9 w-9 rounded-full border border-border text-lg"
          >
            +
          </button>
        </div>
      </div>

      <div>
        <label className="mb-1 block font-semibold">{t.product.notes}</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={200}
          rows={2}
          className="w-full rounded-lg border border-border bg-surface p-2"
        />
      </div>

      <div className="flex items-center justify-between border-t border-border pt-4">
        <span className="text-lg font-bold">
          {t.product.total}: {formatMoney(total, currency, locale)}
        </span>
        <button
          type="button"
          onClick={handleAdd}
          disabled={!canAdd()}
          className="rounded-lg bg-brand px-6 py-3 font-bold text-brand-contrast disabled:opacity-50"
        >
          {added ? "✓" : t.product.addToCart}
        </button>
      </div>
    </div>
  );
}
