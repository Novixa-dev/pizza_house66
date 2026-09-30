"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { Locale } from "@/lib/i18n/dictionaries";
import { getDictionary } from "@/lib/i18n/dictionaries";
import {
  forgetOrder,
  rememberedServerSnapshot,
  rememberedSnapshot,
  subscribeRemembered,
} from "@/lib/order-memory";
import { summarizeRememberedAction } from "@/server/public-actions";
import type { OrderSummary } from "@/server/order-lookup";
import { formatMoney } from "@/lib/money";
import { Badge, Card, EmptyState } from "./ui";
import { ClockIcon, ListIcon, TrashIcon } from "./ui/icons";

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
        action={
          <Link href="/menu" className="font-semibold text-brand underline">
            {t.common.viewMenu}
          </Link>
        }
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
