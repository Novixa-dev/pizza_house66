import { notFound } from "next/navigation";
import { getLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getRestaurant } from "@/server/restaurant";
import { prisma } from "@/lib/db";
import { ProductCustomizer } from "@/components/product-customizer";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const locale = await getLocale();
  const t = getDictionary(locale);
  const restaurant = await getRestaurant();

  const product = await prisma.product.findUnique({
    where: { slug },
    include: { optionGroups: { orderBy: { sortOrder: "asc" }, include: { values: { orderBy: { sortOrder: "asc" } } } } },
  });

  if (!product || product.availability === "HIDDEN") notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-2 text-2xl font-bold">{locale === "ar" ? product.nameAr : product.nameEn}</h1>
      {(locale === "ar" ? product.descriptionAr : product.descriptionEn) && (
        <p className="mb-6 text-muted">{locale === "ar" ? product.descriptionAr : product.descriptionEn}</p>
      )}

      {product.availability === "SOLD_OUT" ? (
        <p className="rounded-lg bg-brand/10 p-4 font-semibold text-brand">{t.product.unavailable}</p>
      ) : (
        <ProductCustomizer
          locale={locale}
          currency={restaurant.currency}
          product={{
            id: product.id,
            slug: product.slug,
            nameAr: product.nameAr,
            nameEn: product.nameEn,
            basePriceMinor: product.basePriceMinor,
            optionGroups: product.optionGroups.map((g) => ({
              id: g.id,
              nameAr: g.nameAr,
              nameEn: g.nameEn,
              required: g.required,
              multiSelect: g.multiSelect,
              values: g.values.map((v) => ({
                id: v.id,
                nameAr: v.nameAr,
                nameEn: v.nameEn,
                priceDeltaMinor: v.priceDeltaMinor,
                available: v.available,
              })),
            })),
          }}
        />
      )}
    </div>
  );
}
