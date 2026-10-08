import Link from "next/link";
import Image from "next/image";
import type { Locale } from "@/lib/i18n/dictionaries";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { pick } from "@/lib/i18n/pick";
import { telLink, whatsappLink } from "@/lib/site";
import type { RestaurantWithConfig } from "@/server/restaurant";
import { InstagramIcon, LockIcon, PhoneIcon, PinIcon, WhatsappIcon } from "./ui/icons";
import { formatOpeningHours } from "@/lib/hours-display";
import { InstallPrompt } from "./install-prompt";

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
          {/* Renders nothing unless this browser can actually install the app. */}
          <div className="mt-4">
            <InstallPrompt
              labels={{
                install: t.common.installApp,
                hint: t.common.installAppHint,
                ios: t.common.installIos,
                done: t.common.installDone,
              }}
            />
          </div>
        </div>

        <nav aria-label={t.nav.primary}>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-muted">
            {t.common.menu}
          </h2>
          {/* These read as plain text links, but they are targets, and a
              14px line box is 18px tall in English. They only cleared 24px in
              Arabic because [dir="rtl"] sets line-height 1.75 — accessible in
              one language and not the other, which is not accessible. */}
          <ul className="space-y-2 text-sm">
            {[
              { href: "/menu", label: t.common.viewMenu },
              { href: "/offers", label: t.common.offers },
              { href: "/orders", label: t.common.myOrders },
              { href: "/about", label: t.common.about },
              { href: "/contact", label: t.common.contact },
              { href: "/faq", label: t.home.faqTitle },
            ].map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="inline-flex min-h-6 items-center text-ink-soft hover:text-brand"
                >
                  {link.label}
                </Link>
              </li>
            ))}
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
          {/* `min-h-6` on each link, not padding: these are the highest-intent
              taps on the site — a customer calling the restaurant — and a
              bare 14px text link renders a 20px-tall target, under the 24px
              WCAG 2.2 floor (SC 2.5.8). Asserted in
              tests/e2e/accessibility.spec.ts so it cannot drift back. */}
          <ul className="space-y-2.5 text-sm">
            {address ? (
              <li className="flex items-start gap-2 text-ink-soft">
                <PinIcon className="mt-0.5 shrink-0 text-base text-brand" />
                <span>{address}</span>
              </li>
            ) : null}
            {tel ? (
              <li>
                <a href={tel} className="flex min-h-6 items-center gap-2 text-ink-soft hover:text-brand">
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
                  className="flex min-h-6 items-center gap-2 text-ink-soft hover:text-accent"
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
                  className="flex min-h-6 items-center gap-2 text-ink-soft hover:text-brand"
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
          {/* The staff entrance sits here rather than in the main navigation:
              it is the one link a customer never needs and staff use daily,
              and every restaurant's team learns to look at the bottom of the
              page for it. Not hidden — hidden would mean a bookmark is the
              only way in, and a new hire has no bookmark. */}
          <nav aria-label={t.pages.staffSignIn} className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link href="/terms" className="inline-flex min-h-6 items-center hover:text-brand">
              {t.pages.termsTitle}
            </Link>
            <Link href="/privacy" className="inline-flex min-h-6 items-center hover:text-brand">
              {t.pages.privacyTitle}
            </Link>
            {/* Not a courtesy: the CC BY and CC BY-SA photographs on the menu
                require their photographers to be credited wherever they
                appear, and the footer is what makes that credit reachable
                from every page. */}
            <Link href="/credits" className="inline-flex min-h-6 items-center hover:text-brand">
              {t.pages.creditsTitle}
            </Link>
            <Link
              href="/admin"
              className="inline-flex min-h-6 items-center gap-1.5 font-semibold hover:text-brand"
            >
              <LockIcon />
              {t.pages.staffSignIn}
            </Link>
          </nav>

          <p>
            {t.common.poweredBy}{" "}
            <span className="font-semibold text-ink-soft">Novixa Restaurant</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
