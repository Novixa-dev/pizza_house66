"use client";

import Link from "next/link";
import { useCart } from "./cart-context";
import { CartIcon } from "./ui/icons";

export function CartLink({ label }: { label: string }) {
  const { itemCount, hydrated } = useCart();

  return (
    <Link
      href="/cart"
      className="relative inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-sm font-semibold text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink"
    >
      <CartIcon className="text-lg" />
      <span className="hidden sm:inline">{label}</span>
      {/* Rendered only after hydration: the server has no idea what's in a
          browser's localStorage, so painting a count before then would flash
          the wrong number. */}
      {hydrated && itemCount > 0 ? (
        <span className="numeric absolute -top-0.5 end-0 min-w-5 rounded-[var(--radius-pill)] bg-brand px-1.5 py-0.5 text-center text-[10px] font-extrabold leading-none text-brand-ink">
          {itemCount}
        </span>
      ) : null}
      <span className="sr-only" aria-live="polite">
        {hydrated ? `${itemCount}` : ""}
      </span>
    </Link>
  );
}
