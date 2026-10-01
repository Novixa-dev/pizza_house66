"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import type { Locale } from "@/lib/i18n/dictionaries";
import { getDictionary } from "@/lib/i18n/dictionaries";
import {
  forgetOrder,
  rememberedServerSnapshot,
  rememberedSnapshot,
  subscribeRemembered,
} from "@/lib/order-memory";
import { reorderAction, summarizeRememberedAction } from "@/server/public-actions";
import type { OrderSummary } from "@/server/order-lookup";
import { formatMoney } from "@/lib/money";
import { useCart } from "./cart-context";
import { Alert, Badge, ButtonLink, Card, EmptyState } from "./ui";
import { AlertIcon, CartIcon, ClockIcon, ListIcon, TrashIcon } from "./ui/icons";

const TONE_TO_BADGE = {
  neutral: "neutral",
  info: "info",
  progress: "warning",
  success: "success",
  danger: "danger",
} as const;

interface SerializedSummary extends Omit<OrderSummary, "requestedPickupAt" | "createdAt"> {
  requestedPickupAt: string;
  createdAt: string;
}

/**
 * The orders this device remembers, with their live status.
 *
 * Client-side because the list lives in the browser: the server has no idea
 * which orders this person placed, and giving it one would mean identifying
 * guests who deliberately did not create an account. The tokens go to the
 * server only to be exchanged for statuses, which grants nothing — anyone
 * holding a token can already open its page.
 */
export function SavedOrders({ locale, timeZone }: { locale: Locale; timeZone: string }) {
  const t = getDictionary(locale);
  // The list is external state, so React subscribes to it rather than copying
  // it in on mount: the server snapshot is empty, which is what the server
  // genuinely knows, and hydration matches without a flash of nothing.
  const remembered = useSyncExternalStore(
    subscribeRemembered,
    rememberedSnapshot,
    rememberedServerSnapshot
  );
  const [summaries, setSummaries] = useState<SerializedSummary[]>([]);
  const [reorderNote, setReorderNote] = useState<string | null>(null);
  const [pending, startReorder] = useTransition();
  const { addItem } = useCart();
  const router = useRouter();
  const tokens = remembered.map((order) => order.token).join(",");

  useEffect(() => {
    if (!tokens) return;
    let cancelled = false;
    summarizeRememberedAction(tokens.split(","))
      .then((result) => {
        if (cancelled) return;
        setSummaries(
          result.map((order) => ({
            ...order,
            requestedPickupAt: new Date(order.requestedPickupAt).toISOString(),
            createdAt: new Date(order.createdAt).toISOString(),
          }))
        );
      })
      .catch(() => {
        // Offline, or the action failed. The references are still on screen
        // from local storage, which is the part that matters.
      });
    return () => {
      cancelled = true;
    };
  }, [tokens]);

  if (remembered.length === 0) {
    return (
      <EmptyState
        icon={<ListIcon />}
        title={t.track.none}
        description={t.track.noneHint}
        action={<ButtonLink href="/menu">{t.common.viewMenu}</ButtonLink>}
      />
    );
  }

  const byToken = new Map(summaries.map((order) => [order.token, order]));
  const rows = remembered.map((entry) => ({ entry, summary: byToken.get(entry.token) }));
  const live = rows.filter((row) => row.summary?.live);
  const past = rows.filter((row) => !row.summary?.live);

  function forget(token: string) {
    if (!window.confirm(t.track.forgetConfirm)) return;
    forgetOrder(token);
  }

  /**
   * Puts a past order back in the basket.
   *
   * The regular who orders the same thing every Thursday is the customer
   * worth keeping, and making them rebuild it by hand each time is the
   * friction that sends them somewhere easier.
   *
   * The server decides what can come back: a withdrawn product or an option
   * that no longer exists is named rather than silently dropped, because a
   * basket quietly missing the thing they came back for is worse than one
   * that says what it could not bring.
   */
  function reorder(token: string) {
    setReorderNote(null);
    startReorder(async () => {
      const result = await reorderAction(token);
      if (!result || result.lines.length === 0) {
        setReorderNote(t.track.reorderEmpty);
        return;
      }
      for (const line of result.lines) {
        addItem({
          productId: line.productId,
          slug: line.slug,
          nameAr: line.nameAr,
          nameEn: line.nameEn,
          imageUrl: line.imageUrl,
          basePriceMinor: line.basePriceMinor,
          quantity: line.quantity,
          options: line.options,
          note: line.note,
        });
      }
      const missing = locale === "ar" ? result.unavailableAr : result.unavailableEn;
      if (missing.length > 0) {
        // Named, and the basket is left on screen rather than navigated away
        // from, so the message is actually read.
        setReorderNote(t.track.reorderPartial.replace("{items}", missing.join("، ")));
        return;
      }
      router.push("/cart");
    });
  }

  const dateTime = new Intl.DateTimeFormat(locale === "ar" ? "ar-YE" : "en-GB", {
    timeZone,
    dateStyle: "medium",
    timeStyle: "short",
  });

  function renderRow({ entry, summary }: (typeof rows)[number]) {
    return (
      <Card as="li" key={entry.token} className="flex items-center gap-3 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/order/${entry.token}`}
              className="numeric font-extrabold text-brand underline-offset-4 hover:underline"
            >
              {entry.reference}
            </Link>
            {summary ? (
              <Badge tone={TONE_TO_BADGE[summary.tone]}>
                {locale === "ar" ? summary.statusLabelAr : summary.statusLabelEn}
              </Badge>
            ) : null}
          </div>
          <p className="numeric mt-1 flex items-center gap-1.5 text-sm text-ink-muted">
            <ClockIcon />
            {dateTime.format(new Date(summary?.requestedPickupAt ?? entry.placedAt))}
            {summary ? (
              <>
                {" · "}
                {formatMoney(summary.totalMinor, summary.currency, locale)}
              </>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          onClick={() => reorder(entry.token)}
          disabled={pending}
          // The label is hidden below `sm` to keep the row on one line, so
          // the button needs a name of its own — otherwise a screen reader
          // on a phone announces "button" and nothing else.
          aria-label={`${t.track.reorder} ${entry.reference}`}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-[var(--radius-sm)] border border-line-strong px-3 text-sm font-semibold text-ink-soft transition-colors hover:border-brand/40 hover:bg-brand-soft hover:text-brand disabled:opacity-60"
        >
          <CartIcon />
          <span className="hidden sm:inline">
            {pending ? t.track.reordering : t.track.reorder}
          </span>
        </button>
        <button
          type="button"
          onClick={() => forget(entry.token)}
          aria-label={`${t.track.forget} ${entry.reference}`}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-ink-muted transition-colors hover:bg-danger-soft hover:text-danger"
        >
          <TrashIcon />
        </button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {reorderNote ? (
        <Alert tone="warning" icon={<AlertIcon />}>
          {reorderNote}
        </Alert>
      ) : null}

      {live.length > 0 ? (
        <section>
          <h2 className="mb-3 font-bold text-ink">{t.track.active}</h2>
          <ul className="space-y-2">{live.map(renderRow)}</ul>
        </section>
      ) : null}

      {past.length > 0 ? (
        <section>
          <h2 className="mb-3 font-bold text-ink">{t.track.past}</h2>
          <ul className="space-y-2">{past.map(renderRow)}</ul>
        </section>
      ) : null}

      <p className="text-xs text-ink-muted">{t.track.deviceOnly}</p>
    </div>
  );
}
