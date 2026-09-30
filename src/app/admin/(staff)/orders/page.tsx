import Link from "next/link";
import type { OrderStatus, PaymentStatus } from "@prisma/client";
import { requirePagePermission } from "@/lib/auth";
import { getLocale, pick } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { formatMoney } from "@/lib/money";
import { formatDateTime, formatTime } from "@/lib/time";
import { getRestaurant } from "@/server/restaurant";
import { releaseDueOrders } from "@/server/orders";
import { listOrders } from "@/server/admin-queries";
import { CUSTOMER_VISIBLE_LABELS, STATUS_TONE } from "@/lib/order-state";
import { Badge, Card, EmptyState, Input, SectionHeading, Select } from "@/components/ui";
import { ListIcon, SearchIcon } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

const ORDER_STATUSES: OrderStatus[] = [
  "PENDING",
  "PAYMENT_PENDING",
  "CONFIRMED",
  "QUEUED",
  "PREPARING",
  "READY",
  "COMPLETED",
  "CANCELLED",
  "REJECTED",
  "REFUNDED",
];

const PAYMENT_STATUSES: PaymentStatus[] = [
  "UNPAID",
  "PENDING",
  "VERIFIED",
  "PAID",
  "REJECTED",
  "REFUNDED",
];

const TONE_TO_BADGE = {
  neutral: "neutral",
  info: "info",
  progress: "warning",
  success: "success",
  danger: "danger",
} as const;

export default async function AdminOrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  await requirePagePermission("orders.read");
  await releaseDueOrders();

  const params = await searchParams;
  const locale = await getLocale();
  const t = getDictionary(locale);
  const restaurant = await getRestaurant();

  const status = single(params.status);
  const paymentStatus = single(params.payment);
  const search = single(params.q);
  const todayOnly = single(params.today) === "1";
  const page = Number(single(params.page) ?? "1") || 1;

  const result = await listOrders({
    status: ORDER_STATUSES.includes(status as OrderStatus) ? (status as OrderStatus) : undefined,
    paymentStatus: PAYMENT_STATUSES.includes(paymentStatus as PaymentStatus)
      ? (paymentStatus as PaymentStatus)
      : undefined,
    search: search || undefined,
    todayOnly,
    page,
  });

  const hasFilters = Boolean(status || paymentStatus || search || todayOnly);

  return (
    <div className="space-y-6">
      <SectionHeading
        level={1}
        title={t.orders.title}
        subtitle={`${result.total} ${t.orders.countNoun}`}
      />

      {/* A plain GET form: filters end up in the URL, so a manager can
          bookmark "today's unpaid orders" and share it with a colleague. */}
      <Card className="p-4">
        <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
          <div className="lg:col-span-2">
            <label htmlFor="q" className="mb-1.5 block text-sm font-semibold text-ink">
              {t.common.search}
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-ink-muted">
                <SearchIcon />
              </span>
              <Input
                id="q"
                name="q"
                defaultValue={search ?? ""}
                placeholder={t.orders.searchPlaceholder}
                className="ps-10"
              />
            </div>
          </div>

          <div>
            <label htmlFor="status" className="mb-1.5 block text-sm font-semibold text-ink">
              {t.orders.filterStatus}
            </label>
            <Select id="status" name="status" defaultValue={status ?? ""}>
              <option value="">{t.common.all}</option>
              {ORDER_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {pick(locale, CUSTOMER_VISIBLE_LABELS[value].ar, CUSTOMER_VISIBLE_LABELS[value].en)}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label htmlFor="payment" className="mb-1.5 block text-sm font-semibold text-ink">
              {t.orders.filterPayment}
            </label>
            <Select id="payment" name="payment" defaultValue={paymentStatus ?? ""}>
              <option value="">{t.common.all}</option>
              {PAYMENT_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {t.paymentStatus[value]}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex items-end gap-2">
            <label className="flex h-11 items-center gap-2 text-sm font-semibold text-ink">
              <input
                type="checkbox"
                name="today"
                value="1"
                defaultChecked={todayOnly}
                className="h-4 w-4 accent-[var(--brand)]"
              />
              {t.orders.filterToday}
            </label>
            <button
              type="submit"
              className="min-h-11 rounded-[var(--radius)] bg-brand px-4 text-sm font-semibold text-brand-ink"
            >
              {t.common.filter}
            </button>
          </div>
        </form>
      </Card>

      {result.orders.length === 0 ? (
        <EmptyState title={hasFilters ? t.orders.emptyFiltered : t.orders.empty} icon={<ListIcon />} />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[56rem] text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-muted">
                <th className="p-3 text-start font-semibold">{t.orders.reference}</th>
                <th className="p-3 text-start font-semibold">{t.orders.customer}</th>
                <th className="p-3 text-start font-semibold">{t.orders.pickup}</th>
                <th className="p-3 text-start font-semibold">{t.orders.kitchenRelease}</th>
                <th className="p-3 text-start font-semibold">{t.orders.status}</th>
                <th className="p-3 text-start font-semibold">{t.orders.payment}</th>
                <th className="p-3 text-end font-semibold">{t.orders.total}</th>
              </tr>
            </thead>
            <tbody>
              {result.orders.map((order) => {
                const label = CUSTOMER_VISIBLE_LABELS[order.status];
                return (
                  <tr key={order.id} className="border-b border-line last:border-0 hover:bg-surface-muted">
                    <td className="p-3">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="numeric font-bold text-brand hover:underline"
                      >
                        {order.reference}
                      </Link>
                      <span className="mt-0.5 block text-xs text-ink-muted">
                        {order.pickupMode === "SCHEDULED" ? t.orders.scheduled : t.orders.asap}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="block text-ink">{order.guestName}</span>
                      <span className="numeric block text-xs text-ink-muted">{order.guestPhone}</span>
                    </td>
                    <td className="numeric p-3 text-ink-soft">
                      {formatDateTime(order.requestedPickupAt, restaurant.timezone, locale)}
                    </td>
                    <td className="numeric p-3 text-ink-muted">
                      {formatTime(order.kitchenReleaseAt, restaurant.timezone, locale)}
                    </td>
                    <td className="p-3">
                      <Badge tone={TONE_TO_BADGE[STATUS_TONE[order.status]]}>
                        {pick(locale, label.ar, label.en)}
                      </Badge>
                    </td>
                    <td className="p-3">
                      {order.payment ? (
                        <Badge
                          tone={
                            order.payment.status === "VERIFIED" || order.payment.status === "PAID"
                              ? "success"
                              : order.payment.status === "REJECTED"
                                ? "danger"
                                : order.payment.status === "PENDING"
                                  ? "warning"
                                  : "neutral"
                          }
                        >
                          {t.paymentStatus[order.payment.status]}
                        </Badge>
                      ) : null}
                    </td>
                    <td className="numeric p-3 text-end font-bold text-ink">
                      {formatMoney(order.totalMinor, order.currency, locale)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {result.pageCount > 1 ? (
        <nav className="flex items-center justify-center gap-2" aria-label="pagination">
          {Array.from({ length: result.pageCount }, (_, index) => index + 1).map((pageNumber) => {
            const query = new URLSearchParams();
            if (search) query.set("q", search);
            if (status) query.set("status", status);
            if (paymentStatus) query.set("payment", paymentStatus);
            if (todayOnly) query.set("today", "1");
            query.set("page", String(pageNumber));
            return (
              <Link
                key={pageNumber}
                href={`/admin/orders?${query.toString()}`}
                aria-current={pageNumber === result.page ? "page" : undefined}
                className={`numeric min-h-9 min-w-9 rounded-[var(--radius-sm)] border px-3 py-1.5 text-center text-sm font-semibold ${
                  pageNumber === result.page
                    ? "border-brand bg-brand text-brand-ink"
                    : "border-line-strong bg-surface text-ink-soft hover:bg-surface-muted"
                }`}
              >
                {pageNumber}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}

function single(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}
