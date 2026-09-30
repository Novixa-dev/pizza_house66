import Link from "next/link";
import Image from "next/image";
import { headers } from "next/headers";
import type { Locale } from "@/lib/i18n/dictionaries";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { otherLocale } from "@/lib/i18n/pick";
import { CartLink } from "./cart-link";
import { Badge } from "./ui";

/**
 * The header is a server component so the cart badge is the only thing that
 * ships JavaScript. Language switching is a plain form POST rather than a
 * client handler, which means it works before hydration and on a device with
 * scripting blocked.
 */
export async function SiteHeader({
  locale,
  isOpen,
  ordersPaused,
}: {
  locale: Locale;
  isOpen: boolean;
  ordersPaused: boolean;
}) {
  const t = getDictionary(locale);

  // Return the customer to the page they switched language on, not to "/".
  // Only the path is kept — an absolute referer could be an open redirect.
  const referer = (await headers()).get("referer");
  let redirectTo = "/";
  if (referer) {
    try {
      const url = new URL(referer);
      redirectTo = `${url.pathname}${url.search}`;
    } catch {
      redirectTo = "/";
    }
  }

  const navLinks = [
    { href: "/menu", label: t.common.menu },
    { href: "/#offers", label: t.common.offers },
    { href: "/#visit", label: t.common.contact },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur-md">
      <div className="container-page flex h-16 items-center justify-between gap-3">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 font-extrabold tracking-tight text-ink"
        >
          <Image src="/brand/logo.svg" alt="" width={34} height={34} priority />
          <span className="text-base sm:text-lg">{t.common.siteName}</span>
        </Link>

        <nav aria-label={t.nav.primary} className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-[var(--radius-sm)] px-3 py-2 text-sm font-semibold text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          {ordersPaused ? (
            <Badge tone="danger" className="hidden sm:inline-flex">
              {t.checkout.orderingPaused.split(".")[0]}
            </Badge>
          ) : (
            <Badge tone={isOpen ? "success" : "neutral"} className="hidden sm:inline-flex">
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${isOpen ? "bg-accent" : "bg-ink-muted"}`}
                aria-hidden="true"
              />
              {isOpen ? t.common.openNow : t.common.closedNow}
            </Badge>
          )}

          <CartLink label={t.common.cart} />

          <form action="/api/locale" method="post" className="contents">
            <input type="hidden" name="locale" value={otherLocale(locale)} />
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <button
              type="submit"
              lang={otherLocale(locale)}
              className="inline-flex min-h-11 items-center rounded-[var(--radius-sm)] border border-line-strong px-2.5 text-xs font-bold text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink"
            >
              {t.common.language}
            </button>
          </form>
        </div>
      </div>

      {/* Mobile nav sits below the bar rather than behind a toggle: three
          links do not justify a JavaScript menu on the critical path. */}
      <nav
        aria-label={t.nav.primary}
        className="scroll-row flex gap-1 border-t border-line px-4 py-2 md:hidden"
      >
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            // `min-h-11` rather than more padding: 44px is what a thumb
            // actually needs, and these three pills are the whole of the
            // navigation on the device most customers order from. They
            // cleared the 24px WCAG floor at 28px — passing is not the same
            // as comfortable.
            className="inline-flex min-h-11 items-center whitespace-nowrap rounded-[var(--radius-pill)] bg-surface-muted px-3.5 text-xs font-bold text-ink-soft"
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
