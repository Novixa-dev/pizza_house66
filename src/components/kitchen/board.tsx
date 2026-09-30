"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { OrderStatus, PickupMode } from "@prisma/client";
import { transitionOrderAction } from "@/server/actions";
import { getDictionary, type Locale } from "@/lib/i18n/dictionaries";
import { formatTime } from "@/lib/time";
import { describeDuration } from "@/lib/duration";
import { Badge } from "../ui";
import { AlertIcon, CheckIcon, ClockIcon, LogoutIcon, PlayIcon, SettingsIcon } from "../ui/icons";

export interface KitchenOrder {
  id: string;
  reference: string;
  status: OrderStatus;
  guestName: string;
  notes: string | null;
  requestedPickupAt: string;
  kitchenReleaseAt: string;
  preparingAt: string | null;
  readyAt: string | null;
  pickupMode: PickupMode;
  items: { id: string; quantity: number; name: string; note: string | null; options: string[] }[];
}

const COLUMNS: { status: OrderStatus; next: OrderStatus }[] = [
  { status: "QUEUED", next: "PREPARING" },
  { status: "PREPARING", next: "READY" },
  { status: "READY", next: "COMPLETED" },
];

/**
 * The kitchen board.
 *
 * A client component because it needs a live clock: the elapsed and remaining
 * timers are what tell a cook which ticket is late, and a server-rendered
 * timestamp would freeze the moment the page loaded. It re-fetches every
 * 20 seconds so a new order appears without anyone touching the tablet.
 */
export function KitchenBoard({
  locale,
  timeZone,
  staffName,
  canUpdate,
  canOpenAdmin,
  title,
  orders,
  upcoming,
}: {
  locale: Locale;
  timeZone: string;
  staffName: string;
  canUpdate: boolean;
  canOpenAdmin: boolean;
  title: string;
  orders: KitchenOrder[];
  upcoming: KitchenOrder[];
}) {
  const t = getDictionary(locale);
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const refresh = setInterval(() => router.refresh(), 20_000);
    return () => {
      clearInterval(tick);
      clearInterval(refresh);
    };
  }, [router]);

  const columnLabels: Record<string, string> = {
    QUEUED: t.kitchen.queued,
    PREPARING: t.kitchen.preparing,
    READY: t.kitchen.ready,
  };
  const actionLabels: Record<string, string> = {
    PREPARING: t.kitchen.start,
    READY: t.kitchen.markReady,
    COMPLETED: t.kitchen.complete,
  };

  return (
    <div className="min-h-screen bg-page">
      <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-line bg-surface px-4 py-3">
        <div className="flex items-center gap-3">
          <Image src="/brand/logo.svg" alt="" width={32} height={32} />
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-ink">{title}</h1>
            <p className="text-xs text-ink-muted">
              {staffName} · {t.kitchen.autoRefresh}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="numeric hidden text-xl font-extrabold text-ink sm:block">
            {formatTime(new Date(now), timeZone, locale)}
          </span>
          {canOpenAdmin ? (
            <Link
              href="/admin"
              aria-label={t.admin.title}
              className="rounded-[var(--radius-sm)] border border-line-strong p-2.5 text-ink-soft hover:bg-surface-muted"
            >
              <SettingsIcon />
            </Link>
          ) : null}
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              aria-label={t.admin.logout}
              className="rounded-[var(--radius-sm)] border border-line-strong p-2.5 text-ink-soft hover:bg-surface-muted"
            >
              <LogoutIcon className="rtl:-scale-x-100" />
            </button>
          </form>
        </div>
      </header>

      <main id="main" className="grid gap-4 p-4 lg:grid-cols-3">
        {COLUMNS.map((column) => {
          const columnOrders = orders.filter((order) => order.status === column.status);
          return (
            <section key={column.status} className="min-w-0">
              <h2 className="mb-3 flex items-center gap-2 text-base font-extrabold text-ink">
                {columnLabels[column.status]}
                <span className="numeric rounded-[var(--radius-pill)] bg-surface-muted px-2 py-0.5 text-sm text-ink-soft">
                  {columnOrders.length}
                </span>
              </h2>
              <div className="space-y-3">
                {columnOrders.length === 0 ? (
                  <p className="rounded-[var(--radius)] border border-dashed border-line-strong p-6 text-center text-sm text-ink-muted">
                    {t.kitchen.empty}
                  </p>
                ) : (
                  columnOrders.map((order) => (
                    <TicketCard
                      key={order.id}
                      order={order}
                      now={now}
                      timeZone={timeZone}
                      locale={locale}
                      nextStatus={column.next}
                      actionLabel={actionLabels[column.next]}
                      canUpdate={canUpdate}
                    />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </main>

      {upcoming.length > 0 ? (
        <section className="border-t border-line bg-surface-muted p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-ink-muted">
            <ClockIcon />
            {t.kitchen.upcoming}
          </h2>
          <ul className="scroll-row flex gap-3">
            {upcoming.map((order) => {
              const startsInMinutes = Math.max(
                0,
                Math.round((new Date(order.kitchenReleaseAt).getTime() - now) / 60000)
              );
              return (
                <li
                  key={order.id}
                  // A recessed surface rather than `opacity-85`: container
                  // opacity composites every descendant toward the page
                  // behind it, which quietly drops the text inside below AA
                  // contrast however carefully the tokens are chosen. A
                  // muted background reads the same and stays measurable.
                  // Caught by tests/e2e/accessibility.spec.ts, which only
                  // sees this lane once scheduled orders exist.
                  className="w-56 shrink-0 rounded-[var(--radius)] border border-line bg-surface-muted p-3"
                >
                  <div className="mb-1 flex items-baseline justify-between">
                    <span className="numeric font-extrabold text-ink">{order.reference}</span>
                    <span className="numeric text-xs text-ink-muted">
                      {formatTime(new Date(order.requestedPickupAt), timeZone, locale)}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-gold">
                    {t.kitchen.startsIn}{" "}
                    {describeDuration(startsInMinutes, locale)}
                  </p>
                  <ul className="mt-2 space-y-0.5 text-sm text-ink-soft">
                    {order.items.slice(0, 3).map((item) => (
                      <li key={item.id} className="truncate">
                        <span className="numeric font-bold">{item.quantity}×</span> {item.name}
                      </li>
                    ))}
                    {order.items.length > 3 ? (
                      <li className="numeric text-xs text-ink-muted">
                        +{order.items.length - 3}
                      </li>
                    ) : null}
                  </ul>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function TicketCard({
  order,
  now,
  timeZone,
  locale,
  nextStatus,
  actionLabel,
  canUpdate,
}: {
  order: KitchenOrder;
  now: number;
  timeZone: string;
  locale: Locale;
  nextStatus: OrderStatus;
  actionLabel: string;
  canUpdate: boolean;
}) {
  const t = getDictionary(locale);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  const pickupAt = new Date(order.requestedPickupAt).getTime();
  const minutesToPickup = Math.round((pickupAt - now) / 60000);

  // "Late" means the pickup time has passed and the food still isn't ready.
  const late = minutesToPickup < 0 && order.status !== "READY";
  const dueSoon = !late && minutesToPickup <= 5 && order.status !== "READY";

  const sinceStamp =
    order.status === "PREPARING"
      ? order.preparingAt
      : order.status === "READY"
        ? order.readyAt
        : null;
  const elapsedMinutes = sinceStamp
    ? Math.max(0, Math.round((now - new Date(sinceStamp).getTime()) / 60000))
    : null;

  function advance() {
    setError(false);
    startTransition(async () => {
      const result = await transitionOrderAction(order.id, nextStatus);
      if (!result.ok) {
        setError(true);
        return;
      }
      router.refresh();
    });
  }

  return (
    <article
      className={`rounded-[var(--radius)] border-2 bg-surface p-4 ${
        late ? "border-danger" : dueSoon ? "border-gold" : "border-line"
      }`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="numeric text-xl font-extrabold text-ink">{order.reference}</p>
          <p className="text-xs text-ink-muted">{order.guestName}</p>
        </div>
        <div className="text-end">
          <p className="numeric text-lg font-extrabold text-ink">
            {formatTime(new Date(order.requestedPickupAt), timeZone, locale)}
          </p>
          {late ? (
            <Badge tone="danger">
              <AlertIcon />
              {t.kitchen.late}{" "}
              {describeDuration(Math.abs(minutesToPickup), locale)}
            </Badge>
          ) : dueSoon ? (
            <Badge tone="warning">{t.kitchen.dueNow}</Badge>
          ) : (
            <span className="text-xs text-ink-muted">
              {describeDuration(minutesToPickup, locale)}
            </span>
          )}
        </div>
      </div>

      <ul className="mb-3 space-y-1.5 border-y border-line py-3">
        {order.items.map((item) => (
          <li key={item.id}>
            <p className="font-bold leading-snug text-ink">
              <span className="numeric">{item.quantity}×</span> {item.name}
            </p>
            {item.options.length > 0 ? (
              <p className="text-sm text-ink-soft">
                {item.options.join(locale === "ar" ? "، " : ", ")}
              </p>
            ) : null}
            {item.note ? (
              <p className="mt-1 rounded-[var(--radius-sm)] bg-gold-soft px-2 py-1 text-sm font-bold text-gold">
                {t.kitchen.noteLabel}: {item.note}
              </p>
            ) : null}
          </li>
        ))}
      </ul>

      {order.notes ? (
        <p className="mb-3 rounded-[var(--radius-sm)] bg-info-soft px-2.5 py-1.5 text-sm font-semibold text-info">
          {order.notes}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        {elapsedMinutes !== null ? (
          <span className="text-xs font-semibold text-ink-muted">
            {t.kitchen.elapsed}{" "}
            {describeDuration(elapsedMinutes, locale)}
          </span>
        ) : (
          <span />
        )}

        {canUpdate ? (
          <button
            type="button"
            onClick={advance}
            disabled={pending}
            // Large target: this is pressed with a knuckle, mid-service.
            className="inline-flex min-h-12 items-center gap-2 rounded-[var(--radius)] bg-brand px-5 text-base font-extrabold text-brand-ink transition-colors hover:bg-brand-hover disabled:opacity-60"
          >
            {nextStatus === "PREPARING" ? <PlayIcon /> : <CheckIcon />}
            {actionLabel}
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="mt-2 text-sm font-semibold text-danger" role="alert">
          {t.common.error} — {t.common.retry}
        </p>
      ) : null}
    </article>
  );
}
