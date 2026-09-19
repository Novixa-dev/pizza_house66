import Link from "next/link";
import { getLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getRestaurant } from "@/server/restaurant";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";

export const metadata = { title: "Menu | القائمة" };

export default async function MenuPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const restaurant = await getRestaurant();

  const categories = await prisma.category.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    include: {
      products: {
        where: { availability: { not: "HIDDEN" } },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-8 text-2xl font-bold">{t.menu.title}</h1>
      {categories.map((category) => (
        <section key={category.id} className="mb-10">
          <h2 className="mb-4 text-lg font-bold text-brand">
            {locale === "ar" ? category.nameAr : category.nameEn}
          </h2>
          {category.products.length === 0 ? (
            <p className="text-sm text-muted">{t.menu.noProducts}</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {category.products.map((product) => {
                const soldOut = product.availability === "SOLD_OUT";
                return (
                  <Link
                    key={product.id}
                    href={soldOut ? "#" : `/product/${product.slug}`}
                    aria-disabled={soldOut}
                    className={`flex items-center justify-between gap-4 rounded-xl border border-border bg-surface p-4 transition ${
                      soldOut ? "cursor-not-allowed opacity-60" : "hover:shadow-md"
                    }`}
                  >
                    <div>
                      <p className="font-semibold">{locale === "ar" ? product.nameAr : product.nameEn}</p>
                      {(locale === "ar" ? product.descriptionAr : product.descriptionEn) && (
                        <p className="text-sm text-muted">
                          {locale === "ar" ? product.descriptionAr : product.descriptionEn}
                        </p>
                      )}
                      {soldOut && <p className="mt-1 text-xs font-semibold text-brand">{t.menu.soldOut}</p>}
                    </div>
                    <p className="whitespace-nowrap font-bold">
                      {formatMoney(product.basePriceMinor, restaurant.currency, locale)}
                    </p>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
