import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, pick } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getOrderByTrackingToken } from "@/server/orders";
import { getRestaurant } from "@/server/restaurant";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { absoluteUrl, telLink, whatsappLink } from "@/lib/site";
import { CUSTOMER_VISIBLE_LABELS, STATUS_TONE } from "@/lib/order-state";
import { Badge, Card, DescriptionRow } from "@/components/ui";
import { PhoneIcon, WhatsappIcon } from "@/components/ui/icons";
import { OrderTimeline } from "@/components/order-timeline";
import { OrderAutoRefresh } from "@/components/order-auto-refresh";
import { RememberOrder } from "@/components/remember-order";
import { ShareOrderLink } from "@/components/share-order-link";
import { ReceiptUploader } from "@/components/receipt-uploader";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  // An order page is private to whoever holds the link; it must never be
  // indexed, and the referrer must not leak the token to outbound links.
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

const TONE_TO_BADGE = {
  neutral: "neutral",
  info: "info",
  progress: "warning",
  success: "success",
  danger: "danger",
} as const;

export default async function OrderTrackingPage({ params }: PageProps<"/order/[token]">) {
  const { token } = await params;
  const locale = await getLocale();
  const t = getDictionary(locale);
  const [restaurant, order] = await Promise.all([getRestaurant(), getOrderByTrackingToken(token)]);

  if (!order) notFound();

  const label = CUSTOMER_VISIBLE_LABELS[order.status];
  const tone = TONE_TO_BADGE[STATUS_TONE[order.status]];
  const whatsapp = whatsappLink(
    restaurant.whatsapp,
    pick(
      locale,
      `مرحبًا، بخصوص طلبي رقم ${order.reference}`,
      `Hello, regarding my order ${order.reference}`
    )
  );
  const tel = telLink(restaurant.phone);

  const isLive = !["COMPLETED", "CANCELLED", "REJECTED", "REFUNDED"].includes(order.status);
  const needsReceipt =
    order.payment?.method === "BANK_TRANSFER" &&
    !order.payment.receipt &&
    order.payment.status !== "VERIFIED" &&
    order.payment.status !== "PAID";

  return (
    <div className="container-page max-w-3xl py-10">
      {/* Only polls while the order is still moving; a completed order has
          nothing left to refresh for. */}
      {isLive ? <OrderAutoRefresh intervalMs={30_000} /> : null}

      {/* The device keeps this order, so closing the tab is no longer how a
          customer loses it. */}
      <RememberOrder
        token={token}
        reference={order.reference}
        placedAt={order.createdAt.toISOString()}
      />

      <Card className="mb-6 p-6 text-center">
        <p className="text-sm text-ink-muted">{t.orderStatus.reference}</p>
        <p className="numeric mt-1 text-3xl font-extrabold tracking-tight text-brand">
          {order.reference}
        </p>
        <div className="mt-4 flex justify-center">
          <Badge tone={tone} className="px-4 py-2 text-sm">
            {pick(locale, label.ar, label.en)}
          </Badge>
        </div>
        {order.status === "READY" ? (
          <p className="mt-4 font-semibold text-accent">{t.orderStatus.readyNow}</p>
        ) : (
          <p className="mt-4 text-sm text-ink-muted">
            {t.orderStatus.pickupAt}:{" "}
            <span className="numeric font-semibold text-ink">
              {formatDateTime(order.requestedPickupAt, restaurant.timezone, locale)}
            </span>
          </p>
        )}
        {isLive ? (
          <p className="mt-2 text-xs text-ink-muted">{t.orderStatus.liveHint}</p>
        ) : null}
      </Card>

      {needsReceipt ? (
        <div className="mb-6">
          <ReceiptUploader
            locale={locale}
            token={token}
            currentReference={order.payment?.referenceNumber ?? ""}
          />
        </div>
      ) : null}

      <Card className="mb-6 p-6">
        <h2 className="mb-5 font-bold text-ink">{t.orderStatus.timeline}</h2>
        <OrderTimeline
          locale={locale}
          timeZone={restaurant.timezone}
          currentStatus={order.status}
          history={order.statusHistory.map((entry) => ({
            toStatus: entry.toStatus,
            createdAt: entry.createdAt.toISOString(),
          }))}
        />
      </Card>

      <Card className="mb-6 p-6">
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
                    <p className="mt-0.5 text-sm text-ink-muted">
                      {item.options
                        .map((option) => pick(locale, option.nameAr, option.nameEn))
                        .join(locale === "ar" ? "، " : ", ")}
                    </p>
                  ) : null}
                  {item.note ? (
                    <p className="mt-1 text-xs italic text-ink-muted">“{item.note}”</p>
                  ) : null}
                </div>
                <p className="numeric shrink-0 font-semibold text-ink">
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
            <DescriptionRow term={t.orderStatus.discount}>
              <span className="numeric text-accent">
                −{formatMoney(order.discountMinor, order.currency, locale)}
              </span>
            </DescriptionRow>
          ) : null}
          <div className="mt-2 flex items-baseline justify-between border-t border-line pt-3">
            <span className="font-extrabold text-ink">{t.orderStatus.total}</span>
            <span className="numeric text-lg font-extrabold text-brand">
              {formatMoney(order.totalMinor, order.currency, locale)}
            </span>
          </div>
        </dl>
      </Card>

      <Card className="mb-6 p-6">
        <h2 className="mb-3 font-bold text-ink">{t.orderStatus.paymentStatus}</h2>
        <dl>
          {order.payment ? (
            <>
              <DescriptionRow term={t.orderStatus.paymentMethod}>
                {t.paymentMethod[order.payment.method]}
              </DescriptionRow>
              <DescriptionRow term={t.orderStatus.paymentStatus}>
                {t.paymentStatus[order.payment.status]}
              </DescriptionRow>
              {order.payment.referenceNumber ? (
                <DescriptionRow term={t.payments.reference}>
                  <span className="numeric">{order.payment.referenceNumber}</span>
                </DescriptionRow>
              ) : null}
              {order.payment.receipt && order.payment.status === "PENDING" ? (
                <p className="mt-2 text-sm text-accent">{t.orderStatus.receiptUploaded}</p>
              ) : null}
            </>
          ) : null}
          <DescriptionRow term={t.orderStatus.placedAt}>
            <span className="numeric">
              {formatDateTime(order.createdAt, restaurant.timezone, locale)}
            </span>
          </DescriptionRow>
        </dl>
      </Card>

      <Card className="p-6">
        <h2 className="mb-3 font-bold text-ink">{t.orderStatus.contactRestaurant}</h2>
        <div className="flex flex-wrap gap-3">
          {tel ? (
            <a
              href={tel}
              className="inline-flex items-center gap-2 rounded-[var(--radius)] border border-line-strong px-4 py-2.5 text-sm font-semibold text-ink hover:bg-surface-muted"
            >
              <PhoneIcon className="text-brand" />
              <span className="numeric">{restaurant.phone}</span>
            </a>
          ) : null}
          {whatsapp ? (
            <a
              href={whatsapp}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-[var(--radius)] border border-line-strong px-4 py-2.5 text-sm font-semibold text-ink hover:bg-surface-muted"
            >
              <WhatsappIcon className="text-accent" />
              {t.common.whatsapp}
            </a>
          ) : null}
        </div>
      </Card>

      <Card className="mt-6 p-6">
        <h2 className="font-bold text-ink">{t.orderStatus.saveLink}</h2>
        <p className="mb-4 mt-1 text-sm text-ink-muted">{t.orderStatus.savedOnDevice}</p>
        <ShareOrderLink
          url={absoluteUrl(`/order/${token}`)}
          reference={order.reference}
          copyLabel={t.orderStatus.copyLink}
          copiedLabel={t.orderStatus.linkCopied}
          whatsappLabel={t.orderStatus.sendToWhatsapp}
          whatsappMessage={pick(locale, "طلبي من بيتزا هاوس 66:", "My Pizza House 66 order:")}
        />
        <p className="mt-4 text-sm">
          <Link href="/orders" className="font-semibold text-brand underline underline-offset-4">
            {t.track.myOrders}
          </Link>
        </p>
      </Card>
    </div>
  );
}
