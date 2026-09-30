import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getLocale, pick } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { formatMoneyDelta } from "@/lib/money";
import { getRestaurant } from "@/server/restaurant";
import {
  deleteOptionGroupAction,
  deleteOptionValueAction,
  saveOptionGroupAction,
  saveOptionValueAction,
} from "@/server/admin-actions";
import { Card, Checkbox, Field, Input, SectionHeading } from "@/components/ui";
import { ArrowLeftIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";
import { ProductForm } from "@/components/admin/product-form";
import { ProductImageField } from "@/components/admin/product-image-field";
import { SubmitButton } from "@/components/admin/submit-button";
import { AdminForm } from "@/components/admin/admin-form";

export const dynamic = "force-dynamic";

export default async function EditProductPage({ params }: PageProps<"/admin/products/[id]">) {
  const session = await requirePagePermission("products.update");
  const { id } = await params;
  const locale = await getLocale();
  const t = getDictionary(locale);

  const [restaurant, categories, product, orderUsage] = await Promise.all([
    getRestaurant(),
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.product.findUnique({
      where: { id },
      include: {
        image: { select: { version: true } },
        optionGroups: {
          orderBy: { sortOrder: "asc" },
          include: { values: { orderBy: { sortOrder: "asc" } } },
        },
      },
    }),
    prisma.orderItem.count({ where: { productId: id } }),
  ]);

  if (!product) notFound();

  const canManageOptions = can(session.role, "addons.manage");

  return (
    <div className="space-y-6">
      <Link
        href="/admin/products"
        className="inline-flex items-center gap-2 text-sm font-semibold text-ink-muted hover:text-brand"
      >
        <ArrowLeftIcon className="rtl:-scale-x-100" />
        {t.products.title}
      </Link>

      <SectionHeading
        level={1}
        title={pick(locale, product.nameAr, product.nameEn)}
        subtitle={t.products.editProduct}
      />

      <ProductImageField locale={locale} product={product} />

      <ProductForm
        locale={locale}
        product={product}
        categories={categories}
        currency={restaurant.currency}
        canDelete={can(session.role, "products.delete") && orderUsage === 0}
      />

      {canManageOptions ? (
        <section className="space-y-4">
          <SectionHeading title={t.products.optionGroups} />

          {product.optionGroups.map((group) => (
            <Card key={group.id} className="p-5">
              <AdminForm locale={locale} action={saveOptionGroupAction} className="mb-4 grid gap-3 sm:grid-cols-5 sm:items-end">
                <input type="hidden" name="id" value={group.id} />
                <input type="hidden" name="productId" value={product.id} />
                <Field label={t.products.nameAr} htmlFor={`g-ar-${group.id}`}>
                  <Input id={`g-ar-${group.id}`} name="nameAr" defaultValue={group.nameAr} required />
                </Field>
                <Field label={t.products.nameEn} htmlFor={`g-en-${group.id}`}>
                  <Input id={`g-en-${group.id}`} name="nameEn" dir="ltr" defaultValue={group.nameEn} required />
                </Field>
                <Field label={t.products.sortOrder} htmlFor={`g-sort-${group.id}`}>
                  <Input id={`g-sort-${group.id}`} name="sortOrder" type="number" dir="ltr" min={0} defaultValue={group.sortOrder} />
                </Field>
                <div className="space-y-2 pb-3">
                  <Checkbox name="required" label={t.products.optionRequired} defaultChecked={group.required} />
                  <Checkbox
                    name="multiSelect"
                    label={t.products.optionMultiSelect}
                    defaultChecked={group.multiSelect}
                  />
                </div>
                <div className="flex gap-2 pb-1">
                  <SubmitButton label={t.common.save} />
                </div>
              </AdminForm>

              <ul className="space-y-2 border-t border-line pt-4">
                {group.values.map((value) => (
                  <li key={value.id}>
                    <AdminForm locale={locale} action={saveOptionValueAction} className="grid gap-2 sm:grid-cols-6 sm:items-end">
                      <input type="hidden" name="id" value={value.id} />
                      <input type="hidden" name="groupId" value={group.id} />
                      <input type="hidden" name="productId" value={product.id} />
                      <Input name="nameAr" defaultValue={value.nameAr} aria-label={t.products.nameAr} required />
                      <Input
                        name="nameEn"
                        dir="ltr"
                        defaultValue={value.nameEn}
                        aria-label={t.products.nameEn}
                        required
                      />
                      <Input
                        name="priceDeltaMinor"
                        type="number"
                        dir="ltr"
                        defaultValue={value.priceDeltaMinor}
                        aria-label={t.products.priceDelta}
                      />
                      <Input
                        name="sortOrder"
                        type="number"
                        dir="ltr"
                        min={0}
                        defaultValue={value.sortOrder}
                        aria-label={t.products.sortOrder}
                      />
                      <div className="flex items-center gap-3">
                        <Checkbox name="available" label={t.products.available} defaultChecked={value.available} />
                        <span className="numeric text-xs text-ink-muted">
                          {formatMoneyDelta(value.priceDeltaMinor, restaurant.currency, locale)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <SubmitButton label={t.common.save} variant="secondary" />
                      </div>
                    </AdminForm>

                    {/* Its own form rather than a second submit button: a
                        `formAction` override would bypass the wrapper that
                        renders the result back to the user. */}
                    <AdminForm locale={locale} action={deleteOptionValueAction} className="mt-1">
                      <input type="hidden" name="id" value={value.id} />
                      <input type="hidden" name="productId" value={product.id} />
                      <button
                        type="submit"
                        aria-label={`${t.common.delete} — ${pick(locale, value.nameAr, value.nameEn)}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-danger hover:underline"
                      >
                        <TrashIcon />
                        {t.common.delete}
                      </button>
                    </AdminForm>
                  </li>
                ))}

                <li>
                  <AdminForm locale={locale} action={saveOptionValueAction} className="grid gap-2 sm:grid-cols-6 sm:items-end">
                    <input type="hidden" name="groupId" value={group.id} />
                    <input type="hidden" name="productId" value={product.id} />
                    <Input name="nameAr" placeholder={t.products.nameAr} aria-label={t.products.nameAr} required />
                    <Input
                      name="nameEn"
                      dir="ltr"
                      placeholder={t.products.nameEn}
                      aria-label={t.products.nameEn}
                      required
                    />
                    <Input
                      name="priceDeltaMinor"
                      type="number"
                      dir="ltr"
                      defaultValue={0}
                      aria-label={t.products.priceDelta}
                    />
                    <Input name="sortOrder" type="number" dir="ltr" min={0} defaultValue={99} aria-label={t.products.sortOrder} />
                    <div className="pb-3">
                      <Checkbox name="available" label={t.products.available} defaultChecked />
                    </div>
                    <SubmitButton label={t.products.addOptionValue} variant="secondary" />
                  </AdminForm>
                </li>
              </ul>

              <AdminForm locale={locale} action={deleteOptionGroupAction} className="mt-4 border-t border-line pt-3">
                <input type="hidden" name="id" value={group.id} />
                <input type="hidden" name="productId" value={product.id} />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-danger hover:underline"
                >
                  <TrashIcon />
                  {t.common.delete} — {pick(locale, group.nameAr, group.nameEn)}
                </button>
              </AdminForm>
            </Card>
          ))}

          <Card className="p-5">
            <h3 className="mb-3 font-bold text-ink">{t.products.addOptionGroup}</h3>
            <AdminForm locale={locale} action={saveOptionGroupAction} className="grid gap-3 sm:grid-cols-5 sm:items-end">
              <input type="hidden" name="productId" value={product.id} />
              <Field label={t.products.nameAr} htmlFor="new-group-ar">
                <Input id="new-group-ar" name="nameAr" required />
              </Field>
              <Field label={t.products.nameEn} htmlFor="new-group-en">
                <Input id="new-group-en" name="nameEn" dir="ltr" required />
              </Field>
              <Field label={t.products.sortOrder} htmlFor="new-group-sort">
                <Input id="new-group-sort" name="sortOrder" type="number" dir="ltr" min={0} defaultValue={product.optionGroups.length} />
              </Field>
              <div className="space-y-2 pb-3">
                <Checkbox name="required" label={t.products.optionRequired} />
                <Checkbox name="multiSelect" label={t.products.optionMultiSelect} />
              </div>
              <div className="pb-1">
                <SubmitButton label={t.common.create} />
              </div>
            </AdminForm>
          </Card>
        </section>
      ) : null}

      {orderUsage > 0 ? (
        <p className="flex items-center gap-2 text-xs text-ink-muted">
          <PlusIcon className="rotate-45" />
          {pick(
            locale,
            `هذا المنتج مرتبط بـ ${orderUsage} طلب سابق — تغيير السعر لا يؤثر على الطلبات القديمة.`,
            `This product appears in ${orderUsage} past orders — changing the price does not alter them.`
          )}
        </p>
      ) : null}
    </div>
  );
}
