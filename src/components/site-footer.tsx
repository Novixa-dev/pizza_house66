import type { Locale } from "@/lib/i18n/dictionaries";
import { getDictionary } from "@/lib/i18n/dictionaries";

export function SiteFooter({
  locale,
  restaurant,
}: {
  locale: Locale;
  restaurant: {
    nameAr: string;
    name: string;
    phone: string | null;
    whatsapp: string | null;
    addressAr: string | null;
    addressEn: string | null;
    instagramUrl: string | null;
  };
}) {
  const t = getDictionary(locale);
  const name = locale === "ar" ? restaurant.nameAr : restaurant.name;
  const address = locale === "ar" ? restaurant.addressAr : restaurant.addressEn;

  return (
    <footer className="mt-16 border-t border-border bg-surface">
      <div className="mx-auto max-w-5xl px-4 py-8 text-sm text-muted">
        <p className="mb-2 font-semibold text-foreground">{name}</p>
        {address && <p className="mb-1">{address}</p>}
        <div className="mt-3 flex flex-wrap gap-4">
          {restaurant.phone && <span>{t.common.contactUs}: {restaurant.phone}</span>}
          {restaurant.whatsapp && (
            <a
              href={`https://wa.me/${restaurant.whatsapp.replace(/[^\d]/g, "")}`}
              className="text-accent hover:underline"
            >
              {t.common.whatsapp}
            </a>
          )}
          {restaurant.instagramUrl && (
            <a href={restaurant.instagramUrl} className="hover:underline" target="_blank" rel="noreferrer">
              Instagram
            </a>
          )}
        </div>
        <p className="mt-6 text-xs opacity-70">
          {locale === "ar"
            ? "بيتزا هاوس — منصة طلب رقمية بواسطة Novixa Restaurant"
            : "Pizza House — Digital ordering platform by Novixa Restaurant"}
        </p>
      </div>
    </footer>
  );
}
