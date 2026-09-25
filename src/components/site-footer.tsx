import Link from "next/link";
import Image from "next/image";
import type { Locale } from "@/lib/i18n/dictionaries";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { pick } from "@/lib/i18n/pick";
import { telLink, whatsappLink } from "@/lib/site";
import type { RestaurantWithConfig } from "@/server/restaurant";
import { InstagramIcon, PhoneIcon, PinIcon, WhatsappIcon } from "./ui/icons";
import { formatOpeningHours } from "@/lib/hours-display";

export function SiteFooter({
  locale,
  restaurant,
}: {
  locale: Locale;
  restaurant: RestaurantWithConfig;
}) {
  const t = getDictionary(locale);
  const name = pick(locale, restaurant.nameAr, restaurant.name);
  const address = pick(locale, restaurant.addressAr, restaurant.addressEn);
  const whatsapp = whatsappLink(restaurant.whatsapp);
  const tel = telLink(restaurant.phone);
  const hours = formatOpeningHours(restaurant.businessHours, locale, t.hours.days);

  return (
    <footer className="mt-20 border-t border-line bg-surface">
      <div className="container-page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="mb-3 flex items-center gap-2.5">
            <Image src="/brand/logo.svg" alt="" width={32} height={32} />
            <span className="text-base font-extrabold text-ink">{name}</span>
          </div>
          {pick(locale, restaurant.taglineAr, restaurant.taglineEn) ? (
            <p className="text-sm text-ink-muted">
              {pick(locale, restaurant.taglineAr, restaurant.taglineEn)}
            </p>
          ) : null}
        </div>

        <nav aria-label={t.nav.primary}>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-muted">
            {t.common.menu}
          </h2>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/menu" className="text-ink-soft hover:text-brand">
                {t.common.viewMenu}
              </Link>
            </li>
            <li>
              <Link href="/#offers" className="text-ink-soft hover:text-brand">
                {t.common.offers}
              </Link>
            </li>
            <li>
              <Link href="/#faq" className="text-ink-soft hover:text-brand">
                {t.home.faqTitle}
              </Link>
            </li>
          </ul>
        </nav>

        <div>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-muted">
            {t.common.openingHours}
          </h2>
          <ul className="space-y-1.5 text-sm text-ink-soft">
            {hours.map((row) => (
              <li key={row.label} className="flex justify-between gap-4">
                <span>{row.label}</span>
                <span className={row.closed ? "text-ink-muted" : "numeric"}>{row.value}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-muted">
            {t.common.contactUs}
          </h2>
          <ul className="space-y-2.5 text-sm">
            {address ? (
              <li className="flex items-start gap-2 text-ink-soft">
                <PinIcon className="mt-0.5 shrink-0 text-base text-brand" />
                <span>{address}</span>
              </li>
            ) : null}
            {tel ? (
              <li>
                <a href={tel} className="flex items-center gap-2 text-ink-soft hover:text-brand">
                  <PhoneIcon className="shrink-0 text-base text-brand" />
                  <span className="numeric">{restaurant.phone}</span>
                </a>
              </li>
            ) : null}
            {whatsapp ? (
              <li>
                <a
                  href={whatsapp}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-ink-soft hover:text-accent"
                >
                  <WhatsappIcon className="shrink-0 text-base text-accent" />
                  {t.common.whatsapp}
                </a>
              </li>
            ) : null}
            {restaurant.instagramUrl ? (
              <li>
                <a
                  href={restaurant.instagramUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-ink-soft hover:text-brand"
                >
                  <InstagramIcon className="shrink-0 text-base" />
                  Instagram
                </a>
              </li>
            ) : null}
          </ul>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="container-page flex flex-wrap items-center justify-between gap-3 py-5 text-xs text-ink-muted">
          <p>
            © <span className="numeric">{new Date().getFullYear()}</span> {name}
          </p>
          <p>
            {t.common.poweredBy}{" "}
            <span className="font-semibold text-ink-soft">Novixa Restaurant</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
