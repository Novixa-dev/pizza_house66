"use client";

import Link from "next/link";
import { useCart } from "./cart-context";

export function CartLink({ label }: { label: string }) {
  const { itemCount } = useCart();
  return (
    <Link href="/cart" className="relative hover:text-brand">
      {label}
      {itemCount > 0 && (
        <span className="absolute -end-3 -top-2 rounded-full bg-brand px-1.5 text-[10px] font-bold text-brand-contrast">
          {itemCount}
        </span>
      )}
    </Link>
  );
}
