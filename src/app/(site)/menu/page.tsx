import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getLocale, pick } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getRestaurant } from "@/server/restaurant";
import { SectionHeading, Alert } from "@/components/ui";
import { AlertIcon } from "@/components/ui/icons";
import { MenuBrowser } from "@/components/menu-browser";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = getDictionary(locale);
  return {
    title: t.menu.title,
    description: t.menu.subtitle,
    alternates: { canonical: "/menu" },
    openGraph: { title: t.menu.title, description: t.menu.subtitle, url: absoluteUrl("/menu") },
  };
}

export default async function MenuPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const restaurant = await getRestaurant();

  const categories = await prisma.category.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    include: {
      products: {
        // HIDDEN products are invisible to customers entirely; SOLD_OUT ones
        // stay listed so people can see the item exists (docs/PRD.md §17).
        where: { availability: { not: "HIDDEN" } },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  const visible = categories.filter((category) => category.products.length > 0);

  return (
    <div className="container-page py-10">
      <SectionHeading level={1} title={t.menu.title} subtitle={t.menu.subtitle} />

      {restaurant.onlineOrderingPaused ? (
        <div className="mb-6">
          <Alert tone="warning" icon={<AlertIcon />}>
            {pick(locale, restaurant.pauseMessageAr, restaurant.pauseMessageEn) ??
              t.checkout.orderingPaused}
          </Alert>
        </div>
      ) : null}

      <MenuBrowser
        locale={locale}
        currency={restaurant.currency}
        categories={visible.map((category) => ({
          id: category.id,
          slug: category.slug,
          name: pick(locale, category.nameAr, category.nameEn),
          description: pick(locale, category.descriptionAr, category.descriptionEn),
          icon: category.icon,
          products: category.products.map((product) => ({
            id: product.id,
            slug: product.slug,
            nameAr: product.nameAr,
            nameEn: product.nameEn,
            descriptionAr: product.descriptionAr,
            descriptionEn: product.descriptionEn,
            imageUrl: product.imageUrl,
            basePriceMinor: product.basePriceMinor,
            availability: product.availability,
            badge: product.badge,
          })),
        }))}
      />
    </div>
  );
}
