import Link from "next/link";
import Image from "next/image";
import { requirePagePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getLocale, pick } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { getRestaurant } from "@/server/restaurant";
import { listPaymentsForReview, listRecentlyReviewedPayments } from "@/server/admin-queries";
import { Badge, Card, DescriptionRow, EmptyState, SectionHeading } from "@/components/ui";
import { CheckCircleIcon, ReceiptIcon } from "@/components/ui/icons";
import { PaymentReviewActions } from "@/components/admin/payment-review-actions";

export const dynamic = "force-dynamic";

/**
 * The cashier's screen: every transfer awaiting a human decision, with the
 * receipt image, the claimed amount and the order beside it so the check can
 * be made without opening three tabs (docs/PRD.md §21).
 */
export default async function AdminPaymentsPage() {
  const session = await requirePagePermission("payments.read");
  const locale = await getLocale();
  const t = getDictionary(locale);
  const restaurant = await getRestaurant();

  const [{ payments: queue, waiting, hidden }, reviewed] = await Promise.all([
    listPaymentsForReview(),
    listRecentlyReviewedPayments(),
  ]);

  const canSeeReceipts = can(session.role, "payments.receipt.read");

  return (
    <div className="space-y-8">
      <SectionHeading level={1} title={t.payments.title} />

      <section>
        <SectionHeading title={`${t.payments.queue} (${waiting})`} />
        {queue.length === 0 ? (
          <EmptyState title={t.payments.empty} icon={<CheckCircleIcon />} />
        ) : (
          <ul className="grid gap-4 lg:grid-cols-2">
            {queue.map((payment) => (
              <Card as="li" key={payment.id} className="p-5">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <Link
                      href={`/admin/orders/${payment.order.id}`}
                      className="numeric text-lg font-extrabold text-brand hover:underline"
                    >
                      {payment.order.reference}
                    </Link>
                    <p className="text-sm text-ink-muted">
                      {payment.order.guestName} ·{" "}
                      <span className="numeric">{payment.order.guestPhone}</span>
                    </p>
                  </div>
                  <Badge tone="warning">{t.paymentStatus[payment.status]}</Badge>
                </div>

                <dl className="mb-4">
                  <DescriptionRow term={t.payments.amount}>
                    <span className="numeric text-base">
                      {formatMoney(payment.amountMinor, payment.currency, locale)}
                    </span>
                  </DescriptionRow>
                  <DescriptionRow term={t.payments.method}>
                    {t.paymentMethod[payment.method]}
                  </DescriptionRow>
                  <DescriptionRow term={t.payments.reference}>
                    <span className="numeric">{payment.referenceNumber ?? "—"}</span>
                  </DescriptionRow>
                  <DescriptionRow term={t.orders.pickup}>
                    <span className="numeric">
                      {formatDateTime(payment.order.requestedPickupAt, restaurant.timezone, locale)}
                    </span>
                  </DescriptionRow>
                </dl>

                {payment.receipt && canSeeReceipts ? (
                  <a
                    href={`/api/receipts/${payment.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mb-4 block overflow-hidden rounded-[var(--radius-sm)] border border-line"
                  >
                    {/* Served through an authorized route, never a public path.
                        `unoptimized` because the optimizer would need to fetch
                        it without the staff session. */}
                    <Image
                      src={`/api/receipts/${payment.id}`}
                      alt={t.payments.receipt}
                      width={480}
                      height={280}
                      unoptimized
                      className="max-h-56 w-full bg-page-elevated object-contain"
                    />
                    <span className="flex items-center justify-center gap-2 border-t border-line bg-surface-muted py-2 text-sm font-semibold text-ink-soft">
                      <ReceiptIcon />
                      {t.payments.viewReceipt}
                    </span>
                  </a>
                ) : (
                  <p className="mb-4 rounded-[var(--radius-sm)] bg-gold-soft px-3 py-2 text-sm font-semibold text-gold">
                    {t.payments.noReceipt}
                  </p>
                )}

                {can(session.role, "payments.verify") ? (
                  <PaymentReviewActions
                    paymentId={payment.id}
                    locale={locale}
                    verifyLabel={t.payments.verify}
                    rejectLabel={t.payments.reject}
                    reasonLabel={t.payments.rejectReason}
                    reasonPlaceholder={t.payments.rejectReasonPlaceholder}
                    cancelLabel={t.common.cancel}
                  />
                ) : null}
              </Card>
            ))}
          </ul>
        )}
        {hidden > 0 ? (
          <p className="mt-4 rounded-[var(--radius-sm)] bg-surface-muted px-4 py-3 text-sm font-semibold text-ink-soft">
            {t.payments.moreWaiting.replace("{count}", String(hidden))}
          </p>
        ) : null}
      </section>

      <section>
        <SectionHeading title={t.payments.history} />
        {reviewed.length === 0 ? (
          <EmptyState title={t.dashboard.noData} />
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-muted">
                  <th className="p-3 text-start font-semibold">{t.orders.reference}</th>
                  <th className="p-3 text-start font-semibold">{t.orders.status}</th>
                  <th className="p-3 text-start font-semibold">{t.payments.reviewedBy}</th>
                  <th className="p-3 text-end font-semibold">{t.payments.amount}</th>
                </tr>
              </thead>
              <tbody>
                {reviewed.map((payment) => {
                  const last = payment.statusHistory[0];
                  return (
                    <tr key={payment.id} className="border-b border-line last:border-0">
                      <td className="numeric p-3 font-bold text-ink">{payment.order.reference}</td>
                      <td className="p-3">
                        <Badge
                          tone={
                            payment.status === "VERIFIED" || payment.status === "PAID"
                              ? "success"
                              : "danger"
                          }
                        >
                          {t.paymentStatus[payment.status]}
                        </Badge>
                        {last?.reason ? (
                          <span className="mt-1 block text-xs text-ink-muted">{last.reason}</span>
                        ) : null}
                      </td>
                      <td className="p-3 text-ink-soft">
                        {last?.reviewedBy?.name ?? "—"}
                        {last ? (
                          <span className="numeric block text-xs text-ink-muted">
                            {formatDateTime(last.createdAt, restaurant.timezone, locale)}
                          </span>
                        ) : null}
                      </td>
                      <td className="numeric p-3 text-end font-bold text-ink">
                        {formatMoney(payment.order.totalMinor, payment.order.currency, locale)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      </section>

      <p className="text-xs text-ink-muted">
        {pick(
          locale,
          "يسجّل النظام اسم المراجع ووقت المراجعة وسبب الرفض لكل عملية.",
          "Every decision records the reviewer, the time, and the rejection reason."
        )}
      </p>
    </div>
  );
}
