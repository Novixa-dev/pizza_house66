import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth";
import { getLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { deleteCategoryAction, saveCategoryAction } from "@/server/admin-actions";
import { Card, Checkbox, EmptyState, Field, Input, SectionHeading, Select, Textarea } from "@/components/ui";
import { ListIcon, TrashIcon } from "@/components/ui/icons";
import { SubmitButton } from "@/components/admin/submit-button";
import { AdminForm } from "@/components/admin/admin-form";

export const dynamic = "force-dynamic";

const ICONS = ["", "pizza", "sides", "drinks", "desserts"];

export default async function AdminCategoriesPage() {
  await requirePagePermission("categories.manage");
  const locale = await getLocale();
  const t = getDictionary(locale);

  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { products: true } } },
  });

  return (
    <div className="space-y-6">
      <SectionHeading level={1} title={t.categories.title} />

      {categories.length === 0 ? (
        <EmptyState title={t.categories.empty} icon={<ListIcon />} />
      ) : (
        <ul className="space-y-3">
          {categories.map((category) => (
            <Card as="li" key={category.id} className="p-5">
              <AdminForm locale={locale} action={saveCategoryAction} className="grid gap-3 lg:grid-cols-6 lg:items-end">
                <input type="hidden" name="id" value={category.id} />
                <Field label={t.products.nameAr} htmlFor={`ar-${category.id}`}>
                  <Input id={`ar-${category.id}`} name="nameAr" defaultValue={category.nameAr} required />
                </Field>
                <Field label={t.products.nameEn} htmlFor={`en-${category.id}`}>
                  <Input id={`en-${category.id}`} name="nameEn" dir="ltr" defaultValue={category.nameEn} required />
                </Field>
                <Field label="Slug" htmlFor={`slug-${category.id}`}>
                  <Input
                    id={`slug-${category.id}`}
                    name="slug"
                    dir="ltr"
                    defaultValue={category.slug}
                    pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                    required
                  />
                </Field>
                <Field label="Icon" htmlFor={`icon-${category.id}`}>
                  <Select id={`icon-${category.id}`} name="icon" defaultValue={category.icon ?? ""}>
                    {ICONS.map((icon) => (
                      <option key={icon} value={icon}>
                        {icon || t.common.none}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={t.products.sortOrder} htmlFor={`sort-${category.id}`}>
                  <Input
                    id={`sort-${category.id}`}
                    name="sortOrder"
                    type="number"
                    dir="ltr"
                    min={0}
                    defaultValue={category.sortOrder}
                  />
                </Field>
                <div className="flex items-center gap-3 pb-1">
                  <Checkbox name="active" label={t.categories.active} defaultChecked={category.active} />
                  <SubmitButton label={t.common.save} variant="secondary" />
                </div>

                <Field label={t.products.descriptionAr} htmlFor={`dar-${category.id}`} className="lg:col-span-3">
                  <Textarea
                    id={`dar-${category.id}`}
                    name="descriptionAr"
                    rows={1}
                    defaultValue={category.descriptionAr ?? ""}
                  />
                </Field>
                <Field label={t.products.descriptionEn} htmlFor={`den-${category.id}`} className="lg:col-span-3">
                  <Textarea
                    id={`den-${category.id}`}
                    name="descriptionEn"
                    dir="ltr"
                    rows={1}
                    defaultValue={category.descriptionEn ?? ""}
                  />
                </Field>
              </AdminForm>

              <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
                <p className="text-sm text-ink-muted">
                  {t.categories.productCount}: <span className="numeric">{category._count.products}</span>
                </p>
                <AdminForm locale={locale} action={deleteCategoryAction}>
                  <input type="hidden" name="id" value={category.id} />
                  <button
                    type="submit"
                    disabled={category._count.products > 0}
                    title={category._count.products > 0 ? t.categories.deleteBlocked : undefined}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-danger hover:underline disabled:cursor-not-allowed disabled:text-ink-muted disabled:no-underline"
                  >
                    <TrashIcon />
                    {t.common.delete}
                  </button>
                </AdminForm>
              </div>
            </Card>
          ))}
        </ul>
      )}

      <Card className="p-5">
        <h2 className="mb-4 font-bold text-ink">{t.categories.newCategory}</h2>
        <AdminForm locale={locale} action={saveCategoryAction} className="grid gap-3 lg:grid-cols-6 lg:items-end">
          <Field label={t.products.nameAr} htmlFor="new-cat-ar">
            <Input id="new-cat-ar" name="nameAr" required />
          </Field>
          <Field label={t.products.nameEn} htmlFor="new-cat-en">
            <Input id="new-cat-en" name="nameEn" dir="ltr" required />
          </Field>
          <Field label="Slug" htmlFor="new-cat-slug">
            <Input id="new-cat-slug" name="slug" dir="ltr" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required />
          </Field>
          <Field label="Icon" htmlFor="new-cat-icon">
            <Select id="new-cat-icon" name="icon" defaultValue="">
              {ICONS.map((icon) => (
                <option key={icon} value={icon}>
                  {icon || t.common.none}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t.products.sortOrder} htmlFor="new-cat-sort">
            <Input id="new-cat-sort" name="sortOrder" type="number" dir="ltr" min={0} defaultValue={categories.length} />
          </Field>
          <div className="flex items-center gap-3 pb-1">
            <Checkbox name="active" label={t.categories.active} defaultChecked />
            <SubmitButton label={t.common.create} />
          </div>
        </AdminForm>
      </Card>
    </div>
  );
}
