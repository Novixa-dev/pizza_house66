import Link from "next/link";
import { notFound } from "next/navigation";
import type { OrderStatus } from "@prisma/client";
import { requirePagePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getLocale, pick } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { getRestaurant } from "@/server/restaurant";
import { getOrderById } from "@/server/orders";
import { allowedTransitionsForRole, CUSTOMER_VISIBLE_LABELS, STATUS_TONE } from "@/lib/order-state";
import { transitionOrderFormAction } from "@/server/actions";
import { Badge, Card, DescriptionRow, SectionHeading } from "@/components/ui";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { ArrowLeftIcon, ReceiptIcon } from "@/components/ui/icons";
import { PaymentReviewActions } from "@/components/admin/payment-review-actions";

export const dynamic = "force-dynamic";

const TONE_TO_BADGE = {
  neutral: "neutral",
  info: "info",
  progress: "warning",
  success: "success",
  danger: "danger",
} as const;

const TRANSITION_LABEL_KEY: Partial<Record<OrderStatus, "confirmOrder" | "cancelOrder" | "markPreparing" | "markReady" | "markCompleted" | "releaseNow">> = {
  CONFIRMED: "confirmOrder",
  QUEUED: "releaseNow",
  PREPARING: "markPreparing",
  READY: "markReady",
  COMPLETED: "markCompleted",
  CANCELLED: "cancelOrder",
};

export default async function AdminOrderDetailPage({ params }: PageProps<"/admin/orders/[id]">) {
  const session = await requirePagePermission("orders.read");
  const { id } = await params;

  const locale = await getLocale();
  const t = getDictionary(locale);
  const [restaurant, order] = await Promise.all([getRestaurant(), getOrderById(id)]);

  if (!order) notFound();

  const label = CUSTOMER_VISIBLE_LABELS[order.status];
  // Only transitions this specific role may perform are offered — the server
  // re-checks anyway, but showing a button that always fails is bad design.
  const transitions = allowedTransitionsForRole(order.status, session.role);

  return (
    <div className="space-y-6">
      <Link
        href="/admin/orders"
        className="inline-flex items-center gap-2 text-sm font-semibold text-ink-muted hover:text-brand"
      >
        <ArrowLeftIcon className="rtl:-scale-x-100" />
        {t.orders.title}
      </Link>

      <SectionHeading
        level={1}
        title={`${t.orders.detailTitle} ${order.reference}`}
        action={
          <Badge tone={TONE_TO_BADGE[STATUS_TONE[order.status]]} className="px-3 py-1.5">
            {pick(locale, label.ar, label.en)}
          </Badge>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-4 font-bold text-ink">{t.orderStatus.items}</h2>
            <ul className="divide-y divide-[var(--line)]">
              {order.items.map((item) => (
                <li key={item.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink">
                        <span className="numeric">{item.quantity}×</span>{" "}
                        {pick(locale, item.nameAr, item.nameEn)}
                      </p>
                      {item.options.length > 0 ? (
                        <ul className="mt-1 space-y-0.5 text-sm text-ink-muted">
                          {item.options.map((option) => (
                            <li key={option.id}>
                              {pick(locale, option.groupNameAr, option.groupNameEn)}:{" "}
                              <span className="text-ink-soft">
                                {pick(locale, option.nameAr, option.nameEn)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {item.note ? (
                        <p className="mt-1 rounded-[var(--radius-sm)] bg-gold-soft px-2 py-1 text-xs font-semibold text-gold">
                          {t.kitchen.noteLabel}: {item.note}
                        </p>
                      ) : null}
                    </div>
                    <p className="numeric shrink-0 font-bold text-ink">
                      {formatMoney(item.lineTotalMinor, order.currency, locale)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            <dl className="mt-4 border-t border-line pt-4">
              <DescriptionRow term={t.orderStatus.subtotal}>
                <span className="numeric">{formatMoney(order.subtotalMinor, order.currency, locale)}</span>
              </DescriptionRow>
              {order.discountMinor > 0 ? (
                <DescriptionRow term={`${t.orderStatus.discount}${order.promoCode ? ` (${order.promoCode})` : ""}`}>
                  <span className="numeric text-accent">
                    −{formatMoney(order.discountMinor, order.currency, locale)}
                  </span>
                </DescriptionRow>
              ) : null}
              <div className="mt-2 flex items-baseline justify-between border-t border-line pt-3">
                <span className="font-extrabold text-ink">{t.orders.total}</span>
                <span className="numeric text-lg font-extrabold text-brand">
                  {formatMoney(order.totalMinor, order.currency, locale)}
                </span>
              </div>
            </dl>
          </Card>

          {order.notes ? (
            <Card className="p-5">
              <h2 className="mb-2 font-bold text-ink">{t.orders.notes}</h2>
              <p className="text-sm text-ink-soft">{order.notes}</p>
            </Card>
          ) : null}

          <Card className="p-5">
            <h2 className="mb-4 font-bold text-ink">{t.orders.history}</h2>
            <ol className="space-y-3">
              {order.statusHistory.map((entry) => (
                <li key={entry.id} className="flex items-baseline gap-3 text-sm">
                  <span className="numeric shrink-0 text-xs text-ink-muted">
                    {formatDateTime(entry.createdAt, restaurant.timezone, locale)}
                  </span>
                  <span className="text-ink">
                    {pick(
                      locale,
                      CUSTOMER_VISIBLE_LABELS[entry.toStatus].ar,
                      CUSTOMER_VISIBLE_LABELS[entry.toStatus].en
                    )}
                  </span>
                  {entry.changedBy ? (
                    <span className="text-xs text-ink-muted">— {entry.changedBy.name}</span>
                  ) : entry.reason === "kitchen_release" ? (
                    <span className="text-xs text-ink-muted">— {t.orders.kitchenRelease}</span>
                  ) : null}
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-3 font-bold text-ink">{t.orders.customer}</h2>
            <dl>
              <DescriptionRow term={t.customers.name}>{order.guestName}</DescriptionRow>
              <DescriptionRow term={t.customers.phone}>
                <a href={`tel:${order.guestPhone}`} className="numeric text-brand hover:underline">
                  {order.guestPhone}
                </a>
              </DescriptionRow>
              <DescriptionRow term={t.orders.placed}>
                <span className="numeric">
                  {formatDateTime(order.createdAt, restaurant.timezone, locale)}
                </span>
              </DescriptionRow>
              <DescriptionRow term={t.orders.pickup}>
                <span className="numeric">
                  {formatDateTime(order.requestedPickupAt, restaurant.timezone, locale)}
                </span>
              </DescriptionRow>
              <DescriptionRow term={t.orders.kitchenRelease}>
                <span className="numeric">
                  {formatDateTime(order.kitchenReleaseAt, restaurant.timezone, locale)}
                </span>
              </DescriptionRow>
            </dl>
          </Card>

          {order.payment ? (
            <Card className="p-5">
              <h2 className="mb-3 font-bold text-ink">{t.admin.payments}</h2>
              <dl>
                <DescriptionRow term={t.payments.method}>
                  {t.paymentMethod[order.payment.method]}
                </DescriptionRow>
                <DescriptionRow term={t.orders.status}>
                  {t.paymentStatus[order.payment.status]}
                </DescriptionRow>
                {order.payment.referenceNumber ? (
                  <DescriptionRow term={t.payments.reference}>
                    <span className="numeric">{order.payment.referenceNumber}</span>
                  </DescriptionRow>
                ) : null}
              </dl>

              {order.payment.receipt && can(session.role, "payments.receipt.read") ? (
                <a
                  href={`/api/receipts/${order.payment.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-2 rounded-[var(--radius-sm)] border border-line-strong px-3 py-2 text-sm font-semibold text-ink hover:bg-surface-muted"
                >
                  <ReceiptIcon />
                  {t.payments.viewReceipt}
                </a>
              ) : order.payment.method === "BANK_TRANSFER" ? (
                <p className="mt-3 text-sm text-ink-muted">{t.payments.noReceipt}</p>
              ) : null}

              {order.payment.status === "PENDING" && can(session.role, "payments.verify") ? (
                <div className="mt-4 border-t border-line pt-4">
                  <PaymentReviewActions
                    paymentId={order.payment.id}
                    locale={locale}
                    verifyLabel={t.payments.verify}
                    rejectLabel={t.payments.reject}
                    reasonLabel={t.payments.rejectReason}
                    reasonPlaceholder={t.payments.rejectReasonPlaceholder}
                    cancelLabel={t.common.cancel}
                  />
                </div>
              ) : null}
            </Card>
          ) : null}

          {transitions.length > 0 ? (
            <Card className="p-5">
              <h2 className="mb-3 font-bold text-ink">{t.orders.actions}</h2>
              <div className="flex flex-wrap gap-2">
                {transitions.map((toStatus) => {
                  const key = TRANSITION_LABEL_KEY[toStatus];
                  const isDanger = toStatus === "CANCELLED" || toStatus === "REJECTED";
                  return (
                    <form key={toStatus} action={transitionOrderFormAction}>
                      <input type="hidden" name="orderId" value={order.id} />
                      <input type="hidden" name="toStatus" value={toStatus} />
                      {isDanger ? <input type="hidden" name="reason" value="cancelled_by_staff" /> : null}
                      {/* Cancelling is terminal — only a refund follows it in
                          the state machine — and this button sits one tab stop
                          from "send to the kitchen now". */}
                      <ConfirmSubmit
                        message={isDanger ? t.admin.confirmCancelOrder : ""}
                        className={`min-h-10 rounded-[var(--radius)] px-4 text-sm font-semibold ${
                          isDanger
                            ? "border border-danger text-danger hover:bg-danger-soft"
                            : "bg-brand text-brand-ink hover:bg-brand-hover"
                        }`}
                      >
                        {key
                          ? t.orders[key]
                          : pick(
                              locale,
                              CUSTOMER_VISIBLE_LABELS[toStatus].ar,
                              CUSTOMER_VISIBLE_LABELS[toStatus].en
                            )}
                      </ConfirmSubmit>
                    </form>
                  );
                })}
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
