import Link from "next/link";
import Image from "next/image";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getLocale, pick } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { formatMoney } from "@/lib/money";
import { matchesTokens, searchHaystack, searchTokens } from "@/lib/search";
import { getRestaurant } from "@/server/restaurant";
import { setProductAvailabilityAction } from "@/server/admin-actions";
import { Badge, ButtonLink, Card, EmptyState, Input, SectionHeading } from "@/components/ui";
import { PizzaIcon, PlusIcon, SearchIcon } from "@/components/ui/icons";
import { AdminForm } from "@/components/admin/admin-form";

export const dynamic = "force-dynamic";

const AVAILABILITY_TONE = {
  AVAILABLE: "success",
  SOLD_OUT: "warning",
  HIDDEN: "neutral",
} as const;

const STATUSES = ["AVAILABLE", "SOLD_OUT", "HIDDEN"] as const;
type Status = (typeof STATUSES)[number];

/** A link that keeps whichever of the two filters it is not changing. */
function filterHref(search: string, status: Status | undefined): string {
  const params = new URLSearchParams();
  if (search) params.set("q", search);
  if (status) params.set("status", status);
  const query = params.toString();
  return query ? `/admin/products?${query}` : "/admin/products";
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminProductsPage({ searchParams }: PageProps<"/admin/products">) {
  const session = await requirePagePermission("products.read");
  const locale = await getLocale();
  const t = getDictionary(locale);
  const restaurant = await getRestaurant();
  const canEdit = can(session.role, "products.update");

  // Filters live in the URL (a plain GET form), so a manager can bookmark
  // "everything still hidden" and a colleague opens the same view.
  //
  // Built for the real menu's size. This screen was written against 16 items;
  // the restaurant's own listing shows roughly 184 across a dozen categories,
  // and the sold-out toggle below is "the single most frequent edit during
  // service". Finding one latte by scrolling past 170 other items mid-rush is
  // not a workflow, so there is a search, and a count by availability — after
  // an import, "how many are still hidden?" is the first question.
  const params = await searchParams;
  const search = (single(params.q) ?? "").trim().slice(0, 80);
  const statusParam = single(params.status);
  const status = STATUSES.find((value) => value === statusParam);
  const hasFilters = Boolean(search || status);

  // Names are matched in memory, not with SQL `contains`, because Postgres
  // cannot treat ة and ه (or أ and ا) as one letter — and a name search that
  // misses on how the Arabic happened to be typed is the failure this screen
  // is being built to avoid. Even at the real menu's ~184 products the names
  // are a few kilobytes, so fetching them to fold is cheaper than it sounds
  // and only happens when someone is actually searching.
  const tokens = searchTokens(search);
  let matchingIds: string[] | undefined;
  if (tokens.length > 0) {
    const names = await prisma.product.findMany({ select: { id: true, nameAr: true, nameEn: true } });
    matchingIds = names
      .filter((product) => matchesTokens(tokens, searchHaystack(product.nameAr, product.nameEn)))
      .map((product) => product.id);
  }

  const where: Prisma.ProductWhereInput = {
    ...(status ? { availability: status } : {}),
    ...(matchingIds ? { id: { in: matchingIds } } : {}),
  };

  const [categories, counts] = await Promise.all([
    prisma.category.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        products: {
          where,
          orderBy: { sortOrder: "asc" },
          include: { _count: { select: { optionGroups: true } } },
        },
      },
    }),
    prisma.product.groupBy({ by: ["availability"], _count: { _all: true } }),
  ]);

  const countByStatus = new Map(counts.map((row) => [row.availability, row._count._all]));
  const overall = counts.reduce((sum, row) => sum + row._count._all, 0);

  // With a filter on, a category with no matching product is noise, not a
  // heading over the words "no products".
  const shown = hasFilters ? categories.filter((category) => category.products.length > 0) : categories;
  const total = shown.reduce((sum, category) => sum + category.products.length, 0);

  return (
    <div className="space-y-6">
      <SectionHeading
        level={1}
        title={t.products.title}
        subtitle={hasFilters ? `${total} / ${overall} ${t.menu.itemsCount}` : `${overall} ${t.menu.itemsCount}`}
        action={
          can(session.role, "products.create") ? (
            <ButtonLink href="/admin/products/new" size="sm">
              <PlusIcon />
              {t.products.newProduct}
            </ButtonLink>
          ) : undefined
        }
      />

      {overall > 0 ? (
        <Card className="space-y-3 p-4">
          <form method="get" role="search" className="flex flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1 basis-56">
              <label htmlFor="q" className="sr-only">
                {t.common.search}
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-ink-muted">
                  <SearchIcon />
                </span>
                <Input
                  id="q"
                  name="q"
                  type="search"
                  defaultValue={search}
                  placeholder={t.products.searchPlaceholder}
                  className="ps-10"
                />
              </div>
            </div>
            {/* Searching must not silently drop the availability filter. */}
            {status ? <input type="hidden" name="status" value={status} /> : null}
            <button
              type="submit"
              className="min-h-11 rounded-[var(--radius)] bg-brand px-4 text-sm font-semibold text-brand-ink"
            >
              {t.common.search}
            </button>
            {hasFilters ? (
              <Link
                href="/admin/products"
                className="inline-flex min-h-11 items-center text-sm font-semibold text-ink-soft underline underline-offset-4 hover:text-ink"
              >
                {t.products.clearFilters}
              </Link>
            ) : null}
          </form>

          <nav aria-label={t.products.filterAvailability} className="flex flex-wrap gap-2">
            {([undefined, ...STATUSES] as (Status | undefined)[]).map((value) => {
              const active = value === status;
              const count = value ? countByStatus.get(value) ?? 0 : overall;
              return (
                <Link
                  key={value ?? "all"}
                  href={filterHref(search, value)}
                  aria-current={active ? "true" : undefined}
                  className={`inline-flex min-h-9 items-center gap-2 rounded-[var(--radius-pill)] border px-3.5 text-sm font-semibold transition-colors ${
                    active
                      ? "border-brand bg-brand text-brand-ink"
                      : "border-line-strong bg-surface text-ink-soft hover:bg-surface-muted"
                  }`}
                >
                  {value ? t.availability[value] : t.common.all}
                  <span className="numeric text-xs opacity-80">{count}</span>
                </Link>
              );
            })}
          </nav>
        </Card>
      ) : null}

      {total === 0 ? (
        <EmptyState title={hasFilters ? t.products.noMatches : t.products.empty} icon={<PizzaIcon />} />
      ) : (
        <div className="space-y-8">
          {shown.map((category) => (
            <section key={category.id}>
              <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-ink-muted">
                {pick(locale, category.nameAr, category.nameEn)}
              </h2>
              {category.products.length === 0 ? (
                <p className="text-sm text-ink-muted">{t.menu.noProducts}</p>
              ) : (
                <ul className="space-y-2">
                  {category.products.map((product) => (
                    /* Wraps: on a phone the badges and the sold-out button used to
                        share the row with the name, leaving it ~110px and four
                        lines tall. Now the actions drop to their own line when
                        the row is too narrow for both — which, at the real
                        menu's ~184 products, is the difference between a
                        scannable list and a very long one. */
                    <Card as="li" key={product.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 p-3">
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-page-elevated">
                        {product.imageUrl ? (
                          <Image src={product.imageUrl} alt="" fill sizes="56px" className="object-cover" />
                        ) : (
                          <span className="flex h-full items-center justify-center text-ink-muted">
                            <PizzaIcon />
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1 basis-44">
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
                              {t.products.optionGroupsCount}
                            </>
                          ) : null}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-wrap items-center gap-2">
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
                              /* Named for what it does, not for a state. The
                                 label used to be the availability word
                                 itself, so a button reading "Sold out" sat
                                 beside a badge reading "Available" and it
                                 took a second look to tell which was the
                                 control — on the one action taken mid-service,
                                 where a mis-tap pulls a dish off the menu.
                                 The product name is in the accessible name
                                 because a screen-reader user hears these 18
                                 buttons as a list, out of the context of the
                                 row they sit in. */
                              aria-label={`${
                                product.availability === "AVAILABLE"
                                  ? t.products.markSoldOut
                                  : t.products.markAvailable
                              } — ${pick(locale, product.nameAr, product.nameEn)}`}
                              className="min-h-9 rounded-[var(--radius-sm)] border border-line-strong px-3 text-xs font-bold text-ink-soft hover:bg-surface-muted"
                            >
                              {product.availability === "AVAILABLE"
                                ? t.products.markSoldOut
                                : t.products.markAvailable}
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
