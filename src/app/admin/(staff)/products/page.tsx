import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getLocale, pick } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { formatMoney } from "@/lib/money";
import { getRestaurant } from "@/server/restaurant";
import { setProductAvailabilityAction } from "@/server/admin-actions";
import { Badge, ButtonLink, Card, EmptyState, SectionHeading } from "@/components/ui";
import { PizzaIcon, PlusIcon } from "@/components/ui/icons";
import { AdminForm } from "@/components/admin/admin-form";

export const dynamic = "force-dynamic";

const AVAILABILITY_TONE = {
  AVAILABLE: "success",
  SOLD_OUT: "warning",
  HIDDEN: "neutral",
} as const;

export default async function AdminProductsPage() {
  const session = await requirePagePermission("products.read");
  const locale = await getLocale();
  const t = getDictionary(locale);
  const restaurant = await getRestaurant();
  const canEdit = can(session.role, "products.update");

  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      products: {
        orderBy: { sortOrder: "asc" },
        include: { _count: { select: { optionGroups: true } } },
      },
    },
  });

  const total = categories.reduce((sum, category) => sum + category.products.length, 0);

  return (
    <div className="space-y-6">
      <SectionHeading
        level={1}
        title={t.products.title}
        subtitle={`${total} ${t.menu.itemsCount}`}
        action={
          can(session.role, "products.create") ? (
            <ButtonLink href="/admin/products/new" size="sm">
              <PlusIcon />
              {t.products.newProduct}
            </ButtonLink>
          ) : undefined
        }
      />

      {total === 0 ? (
        <EmptyState title={t.products.empty} icon={<PizzaIcon />} />
      ) : (
        <div className="space-y-8">
          {categories.map((category) => (
            <section key={category.id}>
              <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-ink-muted">
                {pick(locale, category.nameAr, category.nameEn)}
              </h2>
              {category.products.length === 0 ? (
                <p className="text-sm text-ink-muted">{t.menu.noProducts}</p>
              ) : (
                <ul className="space-y-2">
                  {category.products.map((product) => (
                    <Card as="li" key={product.id} className="flex items-center gap-4 p-3">
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-page-elevated">
                        {product.imageUrl ? (
                          <Image src={product.imageUrl} alt="" fill sizes="56px" className="object-cover" />
                        ) : (
                          <span className="flex h-full items-center justify-center text-ink-muted">
                            <PizzaIcon />
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        {canEdit ? (
                          <Link
                            href={`/admin/products/${product.id}`}
                            className="font-bold text-ink hover:text-brand"
                          >
                            {pick(locale, product.nameAr, product.nameEn)}
                          </Link>
                        ) : (
                          <span className="font-bold text-ink">
                            {pick(locale, product.nameAr, product.nameEn)}
                          </span>
                        )}
                        <p className="text-sm text-ink-muted">
                          <span className="numeric">
                            {formatMoney(product.basePriceMinor, restaurant.currency, locale)}
                          </span>
                          {product._count.optionGroups > 0 ? (
                            <>
                              {" · "}
                              <span className="numeric">{product._count.optionGroups}</span>{" "}
                              {t.products.optionGroups}
                            </>
                          ) : null}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {product.featured ? <Badge tone="brand">{t.badges.featured}</Badge> : null}
                        <Badge tone={AVAILABILITY_TONE[product.availability]}>
                          {t.availability[product.availability]}
                        </Badge>

                        {/* One-tap sold-out toggle: the single most frequent
                            edit during service, so it must not require opening
                            the product form (docs/PRD.md §95). */}
                        {canEdit ? (
                          <AdminForm locale={locale} action={setProductAvailabilityAction}>
                            <input type="hidden" name="id" value={product.id} />
                            <input
                              type="hidden"
                              name="availability"
                              value={product.availability === "AVAILABLE" ? "SOLD_OUT" : "AVAILABLE"}
                            />
                            <button
                              type="submit"
                              className="min-h-9 rounded-[var(--radius-sm)] border border-line-strong px-3 text-xs font-bold text-ink-soft hover:bg-surface-muted"
                            >
                              {product.availability === "AVAILABLE"
                                ? t.availability.SOLD_OUT
                                : t.availability.AVAILABLE}
                            </button>
                          </AdminForm>
                        ) : null}
                      </div>
                    </Card>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
