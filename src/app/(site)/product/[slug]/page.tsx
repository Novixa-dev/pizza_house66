import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getLocale, pick } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { describeDuration } from "@/lib/duration";
import { getRestaurant } from "@/server/restaurant";
import { productImageUrl } from "@/lib/product-image";
import { absoluteUrl } from "@/lib/site";
import { Alert, Badge, ButtonLink } from "@/components/ui";
import { AlertIcon, ArrowLeftIcon, ClockIcon } from "@/components/ui/icons";
import { ProductCustomizer } from "@/components/product-customizer";
import { ProductCard } from "@/components/product-card";

export const dynamic = "force-dynamic";

async function loadProduct(slug: string) {
  return prisma.product.findUnique({
    where: { slug },
    include: {
      category: true,
      image: { select: { version: true } },
      optionGroups: {
        orderBy: { sortOrder: "asc" },
        include: { values: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });
}

export async function generateMetadata({ params }: PageProps<"/product/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const [locale, product] = await Promise.all([getLocale(), loadProduct(slug)]);
  if (!product || product.availability === "HIDDEN") return { title: "Not found" };

  const name = pick(locale, product.nameAr, product.nameEn);
  const description = pick(locale, product.descriptionAr, product.descriptionEn) ?? undefined;
  return {
    title: name,
    description,
    alternates: { canonical: `/product/${product.slug}` },
    openGraph: {
      title: name,
      description,
      url: absoluteUrl(`/product/${product.slug}`),
      // No `images`: the card generated beside this page (its photograph,
      // name and price) is attached automatically. Pointing at the raw photo
      // instead sent SVG placeholders to WhatsApp, which cannot show them.
    },
  };
}

export default async function ProductPage({ params }: PageProps<"/product/[slug]">) {
  const { slug } = await params;
  const locale = await getLocale();
  const t = getDictionary(locale);
  const [restaurant, product] = await Promise.all([getRestaurant(), loadProduct(slug)]);

  if (!product || product.availability === "HIDDEN") notFound();

  const name = pick(locale, product.nameAr, product.nameEn);
  const description = pick(locale, product.descriptionAr, product.descriptionEn);
  const soldOut = product.availability === "SOLD_OUT";
  const prepMinutes = product.prepMinutes ?? restaurant.defaultPrepMinutes;

  const related = await prisma.product.findMany({
    where: {
      categoryId: product.categoryId,
      id: { not: product.id },
      availability: { not: "HIDDEN" },
    },
    orderBy: { sortOrder: "asc" },
    take: 4,
    include: { image: { select: { version: true } } },
  });

  return (
    <div className="container-page py-8">
      <Link
        href="/menu"
        className="mb-6 inline-flex min-h-6 items-center gap-2 text-sm font-semibold text-ink-muted hover:text-brand"
      >
        {/* The arrow is mirrored by the document direction, so RTL gets the
            arrow pointing the way "back" actually goes. */}
        <ArrowLeftIcon className="rtl:-scale-x-100" />
        {t.common.backToMenu}
      </Link>

      <ProductJsonLd
        name={name}
        description={description}
        image={absoluteUrl(productImageUrl(product))}
        priceMinor={product.basePriceMinor}
        currency={restaurant.currency}
        available={!soldOut}
        slug={product.slug}
      />

      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <div className="relative aspect-square overflow-hidden rounded-[var(--radius-lg)] border border-line bg-page-elevated">
            <Image
              src={productImageUrl(product)}
              alt={name}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 520px"
              className={`object-cover ${soldOut ? "opacity-60 grayscale" : ""}`}
              // An uploaded photo is served by a route rather than a file in
              // /public, so the optimizer has nothing to read at build time.
              unoptimized={Boolean(product.image)}
            />
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-brand">
            {pick(locale, product.category.nameAr, product.category.nameEn)}
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{name}</h1>
          {description ? (
            <p className="mt-3 leading-relaxed text-ink-soft">{description}</p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Badge tone="neutral">
              <ClockIcon />
              {t.product.prepTime}: {describeDuration(prepMinutes, locale)}
            </Badge>
            {product.optionGroups.length > 0 ? (
              <Badge tone="info">{t.menu.customizable}</Badge>
            ) : null}
          </div>

          <div className="mt-6">
            {soldOut ? (
              <div className="space-y-4">
                <Alert tone="warning" icon={<AlertIcon />}>
                  {t.product.unavailable}
                </Alert>
                <ButtonLink href="/menu" variant="secondary">
                  {t.common.backToMenu}
                </ButtonLink>
              </div>
            ) : (
              <ProductCustomizer
                locale={locale}
                currency={restaurant.currency}
                product={{
                  id: product.id,
                  slug: product.slug,
                  nameAr: product.nameAr,
                  nameEn: product.nameEn,
                  imageUrl: productImageUrl(product),
                  basePriceMinor: product.basePriceMinor,
                  optionGroups: product.optionGroups.map((group) => ({
                    id: group.id,
                    nameAr: group.nameAr,
                    nameEn: group.nameEn,
                    required: group.required,
                    multiSelect: group.multiSelect,
                    maxSelect: group.maxSelect,
                    values: group.values.map((value) => ({
                      id: value.id,
                      nameAr: value.nameAr,
                      nameEn: value.nameEn,
                      priceDeltaMinor: value.priceDeltaMinor,
                      available: value.available,
                    })),
                  })),
                }}
              />
            )}
          </div>
        </div>
      </div>

      {related.length > 0 ? (
        <section className="mt-16">
          <h2 className="mb-5 text-lg font-extrabold tracking-tight text-ink">
            {t.product.relatedTitle}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((item) => (
              <ProductCard
                key={item.id}
                product={item}
                locale={locale}
                currency={restaurant.currency}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ProductJsonLd({
  name,
  description,
  image,
  priceMinor,
  currency,
  available,
  slug,
}: {
  name: string;
  description: string | null;
  image: string | null;
  priceMinor: number;
  currency: string;
  available: boolean;
  slug: string;
}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "MenuItem",
    name,
    description: description ?? undefined,
    image: image ? absoluteUrl(image) : undefined,
    url: absoluteUrl(`/product/${slug}`),
    offers: {
      "@type": "Offer",
      price: priceMinor,
      priceCurrency: currency,
      availability: available
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
