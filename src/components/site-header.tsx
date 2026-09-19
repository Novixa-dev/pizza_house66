import Link from "next/link";
import { headers } from "next/headers";
import type { Locale } from "@/lib/i18n/dictionaries";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { otherLocale } from "@/lib/i18n/locale";
import { CartLink } from "./cart-link";

export async function SiteHeader({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  const referer = (await headers()).get("referer");
  const redirectTo = referer ? new URL(referer).pathname : "/";

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg text-brand">
          🍕 <span>{t.common.siteName}</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/menu" className="hover:text-brand">
            {t.common.menu}
          </Link>
          <CartLink label={t.common.cart} />
          <form action="/api/locale" method="post">
            <input type="hidden" name="locale" value={otherLocale(locale)} />
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <button type="submit" className="rounded border border-border px-2 py-1 hover:bg-background">
              {t.common.language}
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
