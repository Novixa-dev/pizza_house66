import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth";
import { getLocale, pick } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getRestaurant } from "@/server/restaurant";
import { toDateInputValue } from "@/lib/time";
import { deletePromotionAction, savePromotionAction } from "@/server/admin-actions";
import { Badge, Card, Checkbox, EmptyState, Field, Input, SectionHeading, Select, Textarea } from "@/components/ui";
import { TagIcon, TrashIcon } from "@/components/ui/icons";
import { SubmitButton } from "@/components/admin/submit-button";
import { AdminForm } from "@/components/admin/admin-form";

export const dynamic = "force-dynamic";

export default async function AdminPromotionsPage() {
  await requirePagePermission("promotions.manage");
  const locale = await getLocale();
  const t = getDictionary(locale);
  const restaurant = await getRestaurant();

  const [promotions, products] = await Promise.all([
    prisma.promotion.findMany({
      orderBy: { createdAt: "desc" },
      include: { products: { select: { productId: true } } },
    }),
    prisma.product.findMany({
      where: { availability: { not: "HIDDEN" } },
      orderBy: { sortOrder: "asc" },
      select: { id: true, nameAr: true, nameEn: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <SectionHeading level={1} title={t.promotions.title} />

      {promotions.length === 0 ? (
        <EmptyState title={t.promotions.empty} icon={<TagIcon />} />
      ) : (
        <ul className="space-y-4">
          {promotions.map((promotion) => {
            const scoped = promotion.products.map((entry) => entry.productId);
            return (
              <Card as="li" key={promotion.id} className="p-5">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <h2 className="font-bold text-ink">{pick(locale, promotion.nameAr, promotion.nameEn)}</h2>
                  {promotion.code ? (
                    <Badge tone="brand" className="numeric">
                      {promotion.code}
                    </Badge>
                  ) : (
                    <Badge tone="info">{t.promotions.codeHint}</Badge>
                  )}
                  <Badge tone={promotion.active ? "success" : "neutral"}>
                    {promotion.active ? t.promotions.active : t.common.no}
                  </Badge>
                  <span className="text-xs text-ink-muted">
                    {t.promotions.usageCount}:{" "}
                    <span className="numeric">
                      {promotion.usageCount}
                      {promotion.usageLimit ? ` / ${promotion.usageLimit}` : ""}
                    </span>
                  </span>
                </div>

                <PromotionFields
                  promotion={promotion}
                  scoped={scoped}
                  products={products}
                  locale={locale}
                  currency={restaurant.currency}
                  timezone={restaurant.timezone}
                  t={t}
                />

                <AdminForm locale={locale} action={deletePromotionAction} className="mt-4 border-t border-line pt-3">
                  <input type="hidden" name="id" value={promotion.id} />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-danger hover:underline"
                  >
                    <TrashIcon />
                    {t.common.delete}
                  </button>
                </AdminForm>
              </Card>
            );
          })}
        </ul>
      )}

      <Card className="p-5">
        <h2 className="mb-4 font-bold text-ink">{t.promotions.newPromotion}</h2>
        <PromotionFields
          promotion={null}
          scoped={[]}
          products={products}
          locale={locale}
          currency={restaurant.currency}
          timezone={restaurant.timezone}
          t={t}
        />
      </Card>
    </div>
  );
}

type Dict = ReturnType<typeof getDictionary>;

function PromotionFields({
  promotion,
  scoped,
  products,
  locale,
  currency,
  timezone,
  t,
}: {
  promotion: {
    id: string;
    code: string | null;
    nameAr: string;
    nameEn: string;
    descriptionAr: string | null;
    descriptionEn: string | null;
    discountType: "PERCENTAGE" | "FIXED";
    discountValue: number;
    minOrderMinor: number;
    maxDiscountMinor: number | null;
    startsAt: Date | null;
    endsAt: Date | null;
    usageLimit: number | null;
    active: boolean;
  } | null;
  scoped: string[];
  products: { id: string; nameAr: string; nameEn: string }[];
  locale: "ar" | "en";
  currency: string;
  timezone: string;
  t: Dict;
}) {
  const id = promotion?.id ?? "new";

  return (
    <AdminForm locale={locale} action={savePromotionAction} className="space-y-4">
      {promotion ? <input type="hidden" name="id" value={promotion.id} /> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={t.products.nameAr} htmlFor={`p-ar-${id}`} required>
          <Input id={`p-ar-${id}`} name="nameAr" defaultValue={promotion?.nameAr ?? ""} required />
        </Field>
        <Field label={t.products.nameEn} htmlFor={`p-en-${id}`} required>
          <Input id={`p-en-${id}`} name="nameEn" dir="ltr" defaultValue={promotion?.nameEn ?? ""} required />
        </Field>
        <Field label={t.promotions.code} htmlFor={`p-code-${id}`} hint={t.promotions.codeHint}>
          <Input id={`p-code-${id}`} name="code" dir="ltr" defaultValue={promotion?.code ?? ""} maxLength={40} />
        </Field>
        <Field label={t.promotions.discountType} htmlFor={`p-type-${id}`}>
          <Select id={`p-type-${id}`} name="discountType" defaultValue={promotion?.discountType ?? "PERCENTAGE"}>
            <option value="PERCENTAGE">{t.promotions.percentage}</option>
            <option value="FIXED">{t.promotions.fixed}</option>
          </Select>
        </Field>

        <Field label={t.promotions.discountValue} htmlFor={`p-value-${id}`} required>
          <Input
            id={`p-value-${id}`}
            name="discountValue"
            type="number"
            dir="ltr"
            min={1}
            defaultValue={promotion?.discountValue ?? 10}
            required
          />
        </Field>
        <Field label={`${t.promotions.minOrder} (${currency})`} htmlFor={`p-min-${id}`}>
          <Input
            id={`p-min-${id}`}
            name="minOrderMinor"
            type="number"
            dir="ltr"
            min={0}
            defaultValue={promotion?.minOrderMinor ?? 0}
          />
        </Field>
        <Field label={`${t.promotions.maxDiscount} (${currency})`} htmlFor={`p-max-${id}`}>
          <Input
            id={`p-max-${id}`}
            name="maxDiscountMinor"
            type="number"
            dir="ltr"
            min={0}
            defaultValue={promotion?.maxDiscountMinor ?? ""}
          />
        </Field>
        <Field label={t.promotions.usageLimit} htmlFor={`p-limit-${id}`}>
          <Input
            id={`p-limit-${id}`}
            name="usageLimit"
            type="number"
            dir="ltr"
            min={1}
            defaultValue={promotion?.usageLimit ?? ""}
          />
        </Field>

        <Field label={t.promotions.startsAt} htmlFor={`p-start-${id}`}>
          <Input id={`p-start-${id}`} name="startsAt" type="date" dir="ltr" defaultValue={toDateInputValue(promotion?.startsAt ?? null, timezone)} />
        </Field>
        <Field label={t.promotions.endsAt} htmlFor={`p-end-${id}`}>
          <Input id={`p-end-${id}`} name="endsAt" type="date" dir="ltr" defaultValue={toDateInputValue(promotion?.endsAt ?? null, timezone)} />
        </Field>
        <Field label={t.products.descriptionAr} htmlFor={`p-dar-${id}`} className="lg:col-span-2">
          <Textarea id={`p-dar-${id}`} name="descriptionAr" rows={1} defaultValue={promotion?.descriptionAr ?? ""} />
        </Field>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink">
          {t.promotions.scope} — {t.promotions.scopeProducts}
        </legend>
        <p className="mb-2 text-xs text-ink-muted">{t.promotions.scopeOrder}</p>
        {/* Which products the discount applies to is the most consequential
            choice on this form, and it was in the smallest box on it: 160px
            held four and a half rows of a six-row grid, so the list always
            ended on a sliced line that read as a rendering fault. Tall enough
            for a full menu at desktop width, still capped for a restaurant
            with hundreds of products. */}
        <div className="grid max-h-64 gap-1.5 overflow-y-auto rounded-[var(--radius-sm)] border border-line p-3 sm:grid-cols-3">
          {products.map((product) => (
            <Checkbox
              key={product.id}
              name="productIds"
              value={product.id}
              defaultChecked={scoped.includes(product.id)}
              label={pick(locale, product.nameAr, product.nameEn)}
            />
          ))}
        </div>
      </fieldset>

      <div className="flex items-center gap-4">
        <Checkbox name="active" label={t.promotions.active} defaultChecked={promotion?.active ?? true} />
        <SubmitButton label={promotion ? t.common.save : t.common.create} />
      </div>
    </AdminForm>
  );
}
