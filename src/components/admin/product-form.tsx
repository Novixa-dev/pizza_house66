import Link from "next/link";
import type { AvailabilityState, Category, Product } from "@prisma/client";
import type { Locale } from "@/lib/i18n/dictionaries";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { pick } from "@/lib/i18n/pick";
import { saveProductAction, deleteProductAction } from "@/server/admin-actions";
import { Card, Checkbox, Field, Input, Select, Textarea } from "../ui";
import { SubmitButton } from "./submit-button";
import { AdminForm } from "@/components/admin/admin-form";

const AVAILABILITY: AvailabilityState[] = ["AVAILABLE", "SOLD_OUT", "HIDDEN"];
const BADGES = ["", "bestseller", "new", "spicy", "value", "featured"] as const;

/**
 * Create/edit form for a menu item.
 *
 * A plain server-action form: it works without JavaScript, and the values it
 * posts are re-validated on the server, so nothing here is trusted. The delete
 * button is only offered for a product with no order history — the action
 * refuses otherwise and the copy explains why (docs/PRD.md §44).
 */
export function ProductForm({
  locale,
  product,
  categories,
  currency,
  canDelete,
}: {
  locale: Locale;
  product: Product | null;
  categories: Category[];
  currency: string;
  canDelete: boolean;
}) {
  const t = getDictionary(locale);

  return (
    <div className="space-y-6">
      <AdminForm locale={locale} action={saveProductAction} className="space-y-6">
        {product ? <input type="hidden" name="id" value={product.id} /> : null}

        <Card className="p-5">
          <h2 className="mb-4 font-bold text-ink">{t.settings.identity}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.products.nameAr} htmlFor="nameAr" required>
              <Input id="nameAr" name="nameAr" defaultValue={product?.nameAr ?? ""} required maxLength={120} />
            </Field>
            <Field label={t.products.nameEn} htmlFor="nameEn" required>
              <Input id="nameEn" name="nameEn" dir="ltr" defaultValue={product?.nameEn ?? ""} required maxLength={120} />
            </Field>
            <Field label="Slug" htmlFor="slug" hint={t.products.slugHint} required>
              <Input
                id="slug"
                name="slug"
                dir="ltr"
                defaultValue={product?.slug ?? ""}
                required
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                maxLength={60}
              />
            </Field>
            <Field label={t.products.category} htmlFor="categoryId" required>
              <Select id="categoryId" name="categoryId" defaultValue={product?.categoryId ?? categories[0]?.id}>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {pick(locale, category.nameAr, category.nameEn)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t.products.descriptionAr} htmlFor="descriptionAr" className="sm:col-span-2">
              <Textarea
                id="descriptionAr"
                name="descriptionAr"
                rows={2}
                maxLength={400}
                defaultValue={product?.descriptionAr ?? ""}
              />
            </Field>
            <Field label={t.products.descriptionEn} htmlFor="descriptionEn" className="sm:col-span-2">
              <Textarea
                id="descriptionEn"
                name="descriptionEn"
                dir="ltr"
                rows={2}
                maxLength={400}
                defaultValue={product?.descriptionEn ?? ""}
              />
            </Field>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 font-bold text-ink">{t.products.basePrice}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label={`${t.products.basePrice} (${currency})`} htmlFor="basePriceMinor" required>
              <Input
                id="basePriceMinor"
                name="basePriceMinor"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                dir="ltr"
                defaultValue={product?.basePriceMinor ?? 0}
                required
              />
            </Field>
            <Field label={t.products.availability} htmlFor="availability">
              <Select id="availability" name="availability" defaultValue={product?.availability ?? "AVAILABLE"}>
                {AVAILABILITY.map((value) => (
                  <option key={value} value={value}>
                    {t.availability[value]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t.products.prepMinutes} htmlFor="prepMinutes" hint={t.products.prepMinutesHint}>
              <Input
                id="prepMinutes"
                name="prepMinutes"
                type="number"
                inputMode="numeric"
                min={1}
                max={240}
                dir="ltr"
                defaultValue={product?.prepMinutes ?? ""}
              />
            </Field>
            <Field label={t.products.sortOrder} htmlFor="sortOrder">
              <Input
                id="sortOrder"
                name="sortOrder"
                type="number"
                min={0}
                max={999}
                dir="ltr"
                defaultValue={product?.sortOrder ?? 0}
              />
            </Field>
            <Field
              label={t.products.imageUrl}
              htmlFor="imageUrl"
              hint={t.products.imageUrlHint}
              className="sm:col-span-2"
            >
              <Input
                id="imageUrl"
                name="imageUrl"
                dir="ltr"
                placeholder="/menu/pizza-margherita.svg"
                defaultValue={product?.imageUrl ?? ""}
              />
            </Field>
            <Field label={t.products.badge} htmlFor="badge">
              <Select id="badge" name="badge" defaultValue={product?.badge ?? ""}>
                {BADGES.map((value) => (
                  <option key={value} value={value}>
                    {value === "" ? t.common.none : t.badges[value]}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex items-end pb-3">
              <Checkbox
                name="featured"
                label={t.products.featured}
                defaultChecked={product?.featured ?? false}
              />
            </div>
          </div>
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton label={t.common.save} />
          <Link
            href="/admin/products"
            className="text-sm font-semibold text-ink-muted hover:text-brand"
          >
            {t.common.cancel}
          </Link>
        </div>
      </AdminForm>

      {product ? (
        <Card className="border-danger/30 p-5">
          <h2 className="mb-2 font-bold text-danger">{t.common.delete}</h2>
          <p className="mb-4 text-sm text-ink-muted">{t.products.deleteBlocked}</p>
          <AdminForm locale={locale} action={deleteProductAction}>
            <input type="hidden" name="id" value={product.id} />
            <button
              type="submit"
              disabled={!canDelete}
              className="min-h-10 rounded-[var(--radius)] border border-danger px-4 text-sm font-semibold text-danger hover:bg-danger-soft disabled:opacity-40"
            >
              {t.common.delete}
            </button>
          </AdminForm>
        </Card>
      ) : null}
    </div>
  );
}
