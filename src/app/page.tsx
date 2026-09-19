import Link from "next/link";
import Image from "next/image";
import { getLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getRestaurant } from "@/server/restaurant";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";

export default async function HomePage() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const restaurant = await getRestaurant();
  const featured = await prisma.product.findMany({
    where: { featured: true, availability: "AVAILABLE" },
    orderBy: { sortOrder: "asc" },
    take: 4,
  });

  return (
    <div>
      <section className="bg-gradient-to-b from-brand/10 to-transparent">
        <div className="mx-auto max-w-5xl px-4 py-16 text-center">
          <h1 className="mb-4 text-3xl font-extrabold text-foreground sm:text-4xl">
            {t.home.heroTitle}
          </h1>
          <p className="mx-auto mb-8 max-w-xl text-muted">{t.home.heroSubtitle}</p>
          <Link
            href="/menu"
            className="inline-block rounded-lg bg-brand px-8 py-3 font-bold text-brand-contrast shadow hover:bg-brand-dark"
          >
            {t.common.orderNow}
          </Link>
        </div>
      </section>

      {featured.length > 0 && (
        <section className="mx-auto max-w-5xl px-4 py-10">
          <h2 className="mb-6 text-xl font-bold">{t.home.featured}</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {featured.map((p) => (
              <Link
                key={p.id}
                href={`/product/${p.slug}`}
                className="rounded-xl border border-border bg-surface p-3 transition hover:shadow-md"
              >
                <div className="mb-2 aspect-square overflow-hidden rounded-lg bg-background">
                  {p.imageUrl ? (
                    <Image src={p.imageUrl} alt={locale === "ar" ? p.nameAr : p.nameEn} width={200} height={200} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-3xl">🍕</div>
                  )}
                </div>
                <p className="font-semibold">{locale === "ar" ? p.nameAr : p.nameEn}</p>
                <p className="text-sm text-muted">
                  {t.menu.from} {formatMoney(p.basePriceMinor, restaurant.currency, locale)}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-5xl px-4 py-12">
        <h2 className="mb-8 text-center text-xl font-bold">{t.home.howItWorks}</h2>
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            { title: t.home.step1Title, body: t.home.step1Body, icon: "📋" },
            { title: t.home.step2Title, body: t.home.step2Body, icon: "⏰" },
            { title: t.home.step3Title, body: t.home.step3Body, icon: "✅" },
          ].map((step) => (
            <div key={step.title} className="rounded-xl border border-border bg-surface p-6 text-center">
              <div className="mb-3 text-3xl">{step.icon}</div>
              <h3 className="mb-2 font-bold">{step.title}</h3>
              <p className="text-sm text-muted">{step.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
