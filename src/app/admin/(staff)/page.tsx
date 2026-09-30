import Link from "next/link";
import { requirePagePermission } from "@/lib/auth";
import { getLocale, pick } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { formatMoney } from "@/lib/money";
import { formatTime } from "@/lib/time";
import { getRestaurant } from "@/server/restaurant";
import { releaseDueOrders } from "@/server/orders";
import {
  getAttentionQueue,
  getDashboardSnapshot,
  getRecentOrders,
  getTopProductsToday,
} from "@/server/admin-queries";
import { CUSTOMER_VISIBLE_LABELS, STATUS_TONE } from "@/lib/order-state";
import { Badge, ButtonLink, Card, EmptyState, SectionHeading, StatCard } from "@/components/ui";
import {
  AlertIcon,
  CheckCircleIcon,
  ClockIcon,
  ListIcon,
  PizzaIcon,
  WalletIcon,
} from "@/components/ui/icons";

export const dynamic = "force-dynamic";

const TONE_TO_BADGE = {
  neutral: "neutral",
  info: "info",
  progress: "warning",
  success: "success",
  danger: "danger",
} as const;

export default async function AdminDashboardPage() {
  await requirePagePermission("dashboard.read");

  // Opportunistic release: even if the scheduled job is not configured, an
  // order whose kitchen time has come is queued the moment a manager looks at
  // the dashboard (docs/DECISIONS.md).
  await releaseDueOrders();

  const locale = await getLocale();
  const t = getDictionary(locale);
  const restaurant = await getRestaurant();

  const [snapshot, attention, recent, topProducts] = await Promise.all([
    getDashboardSnapshot(),
    getAttentionQueue(),
    getRecentOrders(6),
    getTopProductsToday(5),
  ]);

  const money = (minor: number) => formatMoney(minor, snapshot.currency, locale);

  return (
    <div className="space-y-8">
      <SectionHeading level={1} title={t.admin.dashboard} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t.dashboard.todayOrders} value={String(snapshot.todayOrders)} icon={<ListIcon />} />
        <StatCard
          label={t.dashboard.todaySales}
          value={money(snapshot.todaySalesMinor)}
          hint={`${t.dashboard.avgOrderValue}: ${money(snapshot.avgOrderValueMinor)}`}
          tone="success"
          icon={<WalletIcon />}
        />
        <StatCard
          label={t.dashboard.pendingPayments}
          value={String(snapshot.pendingPayments)}
          tone={snapshot.pendingPayments > 0 ? "danger" : "neutral"}
          icon={<WalletIcon />}
        />
        <StatCard
          label={t.dashboard.upcoming}
          value={String(snapshot.upcomingScheduled)}
          tone="info"
          icon={<ClockIcon />}
        />
        {/* Queued and preparing together, because a manager wants one number
            for what the kitchen still owes them. Counting only PREPARING read
            0 while ten released orders sat unstarted in the queue — the tile
            row said the restaurant was idle when it was behind. The hint
            keeps the split visible: lots queued, few preparing, is exactly
            what "the kitchen is falling behind" looks like. */}
        <StatCard
          label={t.dashboard.inKitchen}
          value={String(snapshot.queued + snapshot.preparing)}
          hint={`${t.dashboard.preparing}: ${snapshot.preparing}`}
          tone="warning"
          icon={<PizzaIcon />}
        />
        <StatCard label={t.dashboard.ready} value={String(snapshot.ready)} tone="success" icon={<CheckCircleIcon />} />
        <StatCard label={t.dashboard.completedToday} value={String(snapshot.completedToday)} />
        <StatCard
          label={t.dashboard.cancelledToday}
          value={String(snapshot.cancelledToday)}
          tone={snapshot.cancelledToday > 0 ? "danger" : "neutral"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <SectionHeading
            title={t.dashboard.needsAttention}
            action={
              <Link href="/admin/orders" className="text-sm font-bold text-brand hover:underline">
                {t.admin.orders}
              </Link>
            }
          />
          {attention.length === 0 ? (
            <EmptyState title={t.dashboard.noAttentionItems} icon={<CheckCircleIcon />} />
          ) : (
            <ul className="space-y-2">
              {attention.map((order) => {
                const label = CUSTOMER_VISIBLE_LABELS[order.status];
                return (
                  <Card as="li" key={order.id} className="p-4">
                    <Link href={`/admin/orders/${order.id}`} className="flex items-center gap-4">
                      <span className="shrink-0 text-lg text-brand">
                        {order.payment?.status === "PENDING" ? <WalletIcon /> : <AlertIcon />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="numeric font-bold text-ink">{order.reference}</span>
                        <span className="block text-sm text-ink-muted">
                          {order.guestName} · <span className="numeric">{order.guestPhone}</span>
                        </span>
                      </span>
                      <span className="shrink-0 text-end">
                        <Badge tone={TONE_TO_BADGE[STATUS_TONE[order.status]]}>
                          {pick(locale, label.ar, label.en)}
                        </Badge>
                        <span className="numeric mt-1 block text-sm font-bold text-ink">
                          {money(order.totalMinor)}
                        </span>
                      </span>
                    </Link>
                  </Card>
                );
              })}
            </ul>
          )}
        </section>

        <div className="space-y-6">
          <section>
            <SectionHeading title={t.dashboard.quickActions} />
            <div className="grid grid-cols-2 gap-2">
              <ButtonLink href="/kitchen" variant="secondary" size="sm">
                {t.admin.kitchen}
              </ButtonLink>
              <ButtonLink href="/admin/payments" variant="secondary" size="sm">
                {t.admin.payments}
              </ButtonLink>
              <ButtonLink href="/admin/products" variant="secondary" size="sm">
                {t.admin.products}
              </ButtonLink>
              <ButtonLink href="/admin/hours" variant="secondary" size="sm">
                {t.admin.hours}
              </ButtonLink>
            </div>
          </section>

          <section>
            <SectionHeading title={t.dashboard.topProducts} />
            <Card className="p-4">
              {topProducts.length === 0 ? (
                <p className="text-sm text-ink-muted">{t.dashboard.noData}</p>
              ) : (
                <ol className="space-y-2">
                  {topProducts.map((product, index) => (
                    <li key={product.nameEn} className="flex items-center gap-3 text-sm">
                      <span className="numeric w-5 shrink-0 font-bold text-ink-muted">{index + 1}</span>
                      <span className="min-w-0 flex-1 truncate text-ink">
                        {pick(locale, product.nameAr, product.nameEn)}
                      </span>
                      <span className="numeric shrink-0 font-bold text-ink">×{product.quantity}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          </section>
        </div>
      </div>

      <section>
        <SectionHeading title={t.dashboard.recentOrders} />
        {recent.length === 0 ? (
          <EmptyState title={t.orders.empty} icon={<ListIcon />} />
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="border-b border-line text-start text-xs uppercase tracking-wide text-ink-muted">
                  <th className="p-3 text-start font-semibold">{t.orders.reference}</th>
                  <th className="p-3 text-start font-semibold">{t.orders.customer}</th>
                  <th className="p-3 text-start font-semibold">{t.orders.pickup}</th>
                  <th className="p-3 text-start font-semibold">{t.orders.status}</th>
                  <th className="p-3 text-end font-semibold">{t.orders.total}</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((order) => {
                  const label = CUSTOMER_VISIBLE_LABELS[order.status];
                  return (
                    <tr key={order.id} className="border-b border-line last:border-0">
                      <td className="p-3">
                        <Link href={`/admin/orders/${order.id}`} className="numeric font-bold text-brand hover:underline">
                          {order.reference}
                        </Link>
                      </td>
                      <td className="p-3 text-ink-soft">{order.guestName}</td>
                      <td className="numeric p-3 text-ink-soft">
                        {formatTime(order.requestedPickupAt, restaurant.timezone, locale)}
                      </td>
                      <td className="p-3">
                        <Badge tone={TONE_TO_BADGE[STATUS_TONE[order.status]]}>
                          {pick(locale, label.ar, label.en)}
                        </Badge>
                      </td>
                      <td className="numeric p-3 text-end font-bold text-ink">{money(order.totalMinor)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      </section>
    </div>
  );
}
