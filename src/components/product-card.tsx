import Link from "next/link";
import Image from "next/image";
import type { Product } from "@prisma/client";
import type { Locale } from "@/lib/i18n/dictionaries";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { FALLBACK_IMAGE } from "@/lib/product-image";
import { pick } from "@/lib/i18n/pick";
import { formatMoney } from "@/lib/money";
import { Badge } from "./ui";


type BadgeKey = keyof ReturnType<typeof getDictionary>["badges"];

const BADGE_TONE = {
  bestseller: "warning",
  new: "info",
  spicy: "danger",
  value: "success",
  featured: "brand",
} as const;

/**
 * One menu item, used on the homepage rail and on the menu page.
 *
 * A sold-out product stays visible but is not a link: the brief wants
 * customers to see it exists (docs/PRD.md §17), and making it a dead anchor
 * would leave a keyboard user tabbing onto something that does nothing.
 */
export function ProductCard({
  product,
  locale,
  currency,
  showFrom = true,
}: {
  product: Pick<
    Product,
    "id" | "slug" | "nameAr" | "nameEn" | "descriptionAr" | "descriptionEn" | "imageUrl" | "basePriceMinor" | "availability" | "badge"
  >;
  locale: Locale;
  currency: string;
  showFrom?: boolean;
}) {
  const t = getDictionary(locale);
  const name = pick(locale, product.nameAr, product.nameEn);
  const description = pick(locale, product.descriptionAr, product.descriptionEn);
  const soldOut = product.availability === "SOLD_OUT";
  const badgeKey = product.badge as BadgeKey | null;

  const media = (
    <div className="relative aspect-4/3 overflow-hidden rounded-[var(--radius-sm)] bg-page-elevated">
      <Image
        src={product.imageUrl ?? FALLBACK_IMAGE}
        alt={name}
        fill
        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 260px"
        className={`object-cover transition-transform duration-500 group-hover:scale-105 ${
          soldOut ? "opacity-55 grayscale" : ""
        }`}
        // A photo the restaurant uploaded is served by an API route, which
        // the build-time optimizer cannot read.
        unoptimized={product.imageUrl?.startsWith("/api/product-images/") ?? false}
      />
      {badgeKey && !soldOut ? (
        <span className="absolute start-2 top-2">
          <Badge tone={BADGE_TONE[badgeKey] ?? "neutral"}>{t.badges[badgeKey]}</Badge>
        </span>
      ) : null}
      {soldOut ? (
        <span className="absolute inset-x-2 bottom-2">
          <Badge tone="danger" className="w-full justify-center">
            {t.menu.soldOut}
          </Badge>
        </span>
      ) : null}
    </div>
  );

  const body = (
    <>
      {media}
      <div className="mt-3 flex flex-1 flex-col">
        <h3 className="font-bold leading-snug text-ink">{name}</h3>
        {description ? (
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-ink-muted">{description}</p>
        ) : null}
        <p className="mt-3 font-extrabold text-brand">
          {showFrom ? <span className="me-1 text-xs font-semibold text-ink-muted">{t.menu.from}</span> : null}
          <span className="numeric">{formatMoney(product.basePriceMinor, currency, locale)}</span>
        </p>
      </div>
    </>
  );

  const shell =
    "flex h-full flex-col rounded-[var(--radius)] border border-line bg-surface p-3 shadow-[var(--shadow-sm)]";

  if (soldOut) {
    return (
      <div className={shell} aria-label={`${name} — ${t.menu.soldOut}`}>
        {body}
      </div>
    );
  }

  return (
    <Link href={`/product/${product.slug}`} className={`${shell} card-interactive`}>
      {body}
    </Link>
  );
}
