"use client";

import { useMemo, useState } from "react";
import type { AvailabilityState } from "@prisma/client";
import type { Locale } from "@/lib/i18n/dictionaries";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { matchesTokens, searchHaystack, searchTokens } from "@/lib/search";
import { ProductCard } from "./product-card";
import { EmptyState, Input } from "./ui";
import { CategoryIcon, SearchIcon } from "./ui/icons";

export interface MenuProduct {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string | null;
  descriptionEn: string | null;
  imageUrl: string | null;
  basePriceMinor: number;
  availability: AvailabilityState;
  badge: string | null;
}

export interface MenuCategory {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  products: MenuProduct[];
}

/**
 * The menu, with a category rail and a search box.
 *
 * Filtering happens client-side over data already on the page: the whole menu
 * is a few dozen items, so a round trip per keystroke would make search feel
 * worse, not better. This is the one place on the public site where that
 * tradeoff favours the client.
 */
export function MenuBrowser({
  categories,
  locale,
  currency,
}: {
  categories: MenuCategory[];
  locale: Locale;
  currency: string;
}) {
  const t = getDictionary(locale);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Search forgives how Arabic is typed (ه for ة, ا for أ, ي for ى — see
  // src/lib/search.ts): a customer whose phone typed the "wrong" one of those
  // would otherwise be told the restaurant does not sell the thing it sells.
  const tokens = useMemo(() => searchTokens(query), [query]);

  // Folded once when the menu arrives rather than on every keystroke. At the
  // restaurant's real size (~184 products, four fields each) that is the
  // difference between a few hundred folds per key press and none.
  const haystacks = useMemo(
    () =>
      new Map(
        categories.flatMap((category) =>
          category.products.map(
            (product) =>
              [
                product.id,
                searchHaystack(product.nameAr, product.nameEn, product.descriptionAr, product.descriptionEn),
              ] as const,
          ),
        ),
      ),
    [categories],
  );

  const filtered = useMemo(() => {
    return categories
      .filter((category) => !activeCategory || category.slug === activeCategory)
      .map((category) => ({
        ...category,
        products: category.products.filter((product) =>
          matchesTokens(tokens, haystacks.get(product.id) ?? ""),
        ),
      }))
      .filter((category) => category.products.length > 0);
  }, [categories, activeCategory, tokens, haystacks]);

  const totalResults = filtered.reduce((sum, category) => sum + category.products.length, 0);

  return (
    <>
      <div className="sticky top-16 z-20 -mx-4 mb-8 border-b border-line bg-page/95 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6">
        <div className="relative mb-3">
          <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-ink-muted">
            <SearchIcon />
          </span>
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.menu.searchPlaceholder}
            aria-label={t.common.search}
            className="ps-10"
          />
        </div>

        <div className="scroll-row flex gap-2" role="group" aria-label={t.menu.allCategories}>
          <CategoryChip
            label={t.menu.allCategories}
            active={activeCategory === null}
            onClick={() => setActiveCategory(null)}
          />
          {categories.map((category) => (
            <CategoryChip
              key={category.id}
              label={category.name}
              icon={category.icon}
              active={activeCategory === category.slug}
              onClick={() => setActiveCategory(category.slug)}
            />
          ))}
        </div>
      </div>

      {/* Announced to screen readers when the result count changes, so search
          is not a silent, visual-only interaction. */}
      <p className="sr-only" role="status" aria-live="polite">
        {totalResults} {t.menu.itemsCount}
      </p>

      {filtered.length === 0 ? (
        <EmptyState
          title={tokens.length > 0 ? t.menu.noResults : t.menu.noProducts}
          icon={<SearchIcon />}
        />
      ) : (
        <div className="space-y-12">
          {filtered.map((category) => (
            <section key={category.id} id={category.slug} className="scroll-mt-40">
              <div className="mb-4">
                <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-ink">
                  <span className="text-brand">
                    <CategoryIcon name={category.icon} />
                  </span>
                  {category.name}
                </h2>
                {category.description ? (
                  <p className="mt-1 text-sm text-ink-muted">{category.description}</p>
                ) : null}
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {category.products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    locale={locale}
                    currency={currency}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

function CategoryChip({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon?: string | null;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[var(--radius-pill)] border px-4 py-2 text-sm font-bold transition-colors ${
        active
          ? "border-brand bg-brand text-brand-ink"
          : "border-line-strong bg-surface text-ink-soft hover:bg-surface-muted"
      }`}
    >
      {icon ? <CategoryIcon name={icon} /> : null}
      {label}
    </button>
  );
}
