"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "./cart-context";
import { formatMoney } from "@/lib/money";
import type { Locale } from "@/lib/i18n/dictionaries";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { CartIcon } from "./ui/icons";

/**
 * The phone-sized action bar pinned to the bottom of the customer site.
 *
 * Most of this restaurant's traffic is one-handed on a phone, where the
 * header's cart link sits at the far end of a long thumb reach and scrolls
 * away besides. Every ordering site worth copying has settled on the same
 * answer — a persistent bottom bar that carries the next step — so this does
 * too, with one difference: it says what is actually in the basket rather
 * than repeating a generic "order now". A customer three items in sees the
 * running total without going anywhere to look for it.
 *
 * Deliberate omissions:
 *
 * - Hidden from `sm:` up. On a laptop the header is already in view and a
 *   fixed bar would just cover content.
 * - Hidden on /cart and /checkout, which *are* the next step. A bar linking
 *   to the page you are on is noise, and on checkout it would cover the
 *   submit button.
 * - Nothing renders until the cart has hydrated. The server cannot know what
 *   a browser's localStorage holds, so painting a total before then would
 *   flash a wrong number — the same reason the header's badge waits.
 */
export function StickyOrderBar({ locale, currency }: { locale: Locale; currency: string }) {
  const pathname = usePathname();
  const { itemCount, subtotalMinor, hydrated } = useCart();
  const t = getDictionary(locale);

  if (pathname === "/cart" || pathname.startsWith("/checkout")) return null;
  if (!hydrated || itemCount === 0) return null;

  return (
    <>
      {/* Scrollable space the height of the bar, so a fixed bar never covers
          the end of the page. It lives here rather than as padding on `main`
          because the bar itself is conditional: reserving the space in the
          layout left a gap below the footer for every visitor with an empty
          basket, which is most of them. */}
      <div aria-hidden className="h-20 sm:hidden" />

      <div
        data-testid="sticky-order-bar"
        // `pb-[max(...)]` keeps the bar clear of a phone's home indicator,
        // falling back to normal padding everywhere that has no inset.
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-page/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:hidden"
      >
        <Link
          href="/cart"
          className="flex min-h-12 w-full items-center justify-between gap-3 rounded-[var(--radius)] bg-brand px-4 py-2 font-semibold text-brand-ink shadow-[var(--shadow-sm)] transition-colors hover:bg-brand-hover"
        >
          <span className="flex items-center gap-2">
            <CartIcon className="text-lg" />
            <span className="numeric text-sm">
              {itemCount} · {formatMoney(subtotalMinor, currency, locale)}
            </span>
          </span>
          <span className="text-sm">{t.cart.proceedToCheckout}</span>
        </Link>
      </div>
    </>
  );
}
