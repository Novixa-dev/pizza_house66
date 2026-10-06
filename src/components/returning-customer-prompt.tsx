"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import type { Locale } from "@/lib/i18n/dictionaries";
import { getDictionary } from "@/lib/i18n/dictionaries";
import {
  rememberedServerSnapshot,
  rememberedSnapshot,
  subscribeRemembered,
} from "@/lib/order-memory";
import { ClockIcon, ListIcon } from "./ui/icons";

/**
 * A way back to a previous order, on the first screen a returning customer
 * sees.
 *
 * Reorder was already built and already reachable — from the nav, two taps
 * away. That is one tap too many for what research across the category keeps
 * finding to be the dominant behaviour: Chipotle moved "reorder your last
 * meal" to the top of their homepage after their own data said so, and
 * Domino's built an entire product (Easy Order) around the same finding.
 *
 * It renders nothing for a first-time visitor, which is most of them. The
 * orders live in this browser's localStorage, so the server cannot know
 * whether there are any — `useSyncExternalStore` with an empty server
 * snapshot is what makes that honest: the server renders what it actually
 * knows, which is nothing, and the browser fills it in without a hydration
 * mismatch.
 *
 * It links to /orders rather than reordering in place. The reorder itself
 * rebuilds a basket from live rows at today's prices and has to be able to
 * say which items are no longer available — that belongs on the page built
 * to show it, not in a banner with no room to explain.
 */
export function ReturningCustomerPrompt({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  const remembered = useSyncExternalStore(
    subscribeRemembered,
    rememberedSnapshot,
    rememberedServerSnapshot
  );

  if (remembered.length === 0) return null;

  return (
    <section className="container-page pt-8">
      <Link
        data-testid="returning-customer-prompt"
        href="/orders"
        className="flex min-h-14 items-center justify-between gap-4 rounded-[var(--radius)] border border-line-strong bg-surface px-4 py-3 transition-colors hover:border-brand hover:bg-surface-muted"
      >
        <span className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-brand-soft text-brand">
            <ClockIcon />
          </span>
          <span className="min-w-0">
            <span className="block font-bold text-ink">{t.track.reorder}</span>
            <span className="numeric block text-sm text-ink-muted">
              {t.track.savedCount.replace("{count}", String(remembered.length))}
            </span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-sm font-semibold text-brand">
          <ListIcon />
          {t.track.openOrder}
        </span>
      </Link>
    </section>
  );
}
