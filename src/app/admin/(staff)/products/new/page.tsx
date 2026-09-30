import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth";
import { getLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getRestaurant } from "@/server/restaurant";
import { SectionHeading } from "@/components/ui";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { ProductForm } from "@/components/admin/product-form";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  await requirePagePermission("products.create");
  const locale = await getLocale();
  const t = getDictionary(locale);
  const [restaurant, categories] = await Promise.all([
    getRestaurant(),
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <Link
        href="/admin/products"
        className="inline-flex items-center gap-2 text-sm font-semibold text-ink-muted hover:text-brand"
      >
        <ArrowLeftIcon className="rtl:-scale-x-100" />
        {t.products.title}
      </Link>
      <SectionHeading level={1} title={t.products.newProduct} />
      <ProductForm
        locale={locale}
        product={null}
        categories={categories}
        currency={restaurant.currency}
        canDelete={false}
      />
    </div>
  );
}
