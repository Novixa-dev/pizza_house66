import { prisma } from "@/lib/db";
import { releaseDueOrders } from "@/server/orders";
import { getRestaurant } from "@/server/restaurant";
import { formatMoney } from "@/lib/money";
import { CUSTOMER_VISIBLE_LABELS } from "@/lib/order-state";
import { transitionOrderAction, verifyPaymentAction, rejectPaymentAction, togglePausedAction } from "@/server/actions";

export default async function AdminOrdersPage() {
  await releaseDueOrders();
  const restaurant = await getRestaurant();

  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { items: true, payment: true },
  });

  const pauseAction = togglePausedAction.bind(null, !restaurant.onlineOrderingPaused);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">Orders</h1>
        <form action={pauseAction}>
          <button
            type="submit"
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${
              restaurant.onlineOrderingPaused
                ? "bg-accent text-brand-contrast"
                : "bg-brand text-brand-contrast"
            }`}
          >
            {restaurant.onlineOrderingPaused ? "Resume Online Ordering" : "Pause Online Ordering"}
          </button>
        </form>
      </div>

      {orders.length === 0 ? (
        <p className="text-muted">No orders yet.</p>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const label = CUSTOMER_VISIBLE_LABELS[order.status];
            return (
              <div key={order.id} className="rounded-xl border border-border bg-surface p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-bold">{order.reference}</p>
                    <p className="text-sm text-muted">
                      {order.guestName} · {order.guestPhone}
                    </p>
                  </div>
                  <div className="text-end">
                    <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
                      {label.en}
                    </span>
                    <p className="mt-1 text-sm font-semibold">
                      {formatMoney(order.totalMinor, order.currency, "en")}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted">
                  Pickup: {order.requestedPickupAt.toLocaleString()} · Kitchen release:{" "}
                  {order.kitchenReleaseAt.toLocaleString()}
                </p>
                <ul className="mt-2 text-sm">
                  {order.items.map((item) => (
                    <li key={item.id}>
                      {item.quantity}× {item.nameEn}
                    </li>
                  ))}
                </ul>

                {order.payment && order.payment.status === "PENDING" && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg bg-background p-3 text-sm">
                    <span>
                      Bank transfer ref: <strong>{order.payment.referenceNumber}</strong>
                    </span>
                    <form action={verifyPaymentAction.bind(null, order.payment.id)}>
                      <button className="rounded bg-accent px-3 py-1 font-semibold text-brand-contrast" type="submit">
                        Verify
                      </button>
                    </form>
                    <form action={rejectPaymentAction.bind(null, order.payment.id, "Rejected by staff")}>
                      <button className="rounded bg-brand px-3 py-1 font-semibold text-brand-contrast" type="submit">
                        Reject
                      </button>
                    </form>
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {order.status === "PENDING" && (
                    <form action={transitionOrderAction.bind(null, order.id, "CONFIRMED", undefined)}>
                      <ActionButton label="Confirm" />
                    </form>
                  )}
                  {["PENDING", "PAYMENT_PENDING", "CONFIRMED", "QUEUED"].includes(order.status) && (
                    <form action={transitionOrderAction.bind(null, order.id, "CANCELLED", "Cancelled by staff")}>
                      <ActionButton label="Cancel" variant="danger" />
                    </form>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ActionButton({ label, variant = "default" }: { label: string; variant?: "default" | "danger" }) {
  return (
    <button
      type="submit"
      className={`rounded px-3 py-1.5 text-sm font-semibold ${
        variant === "danger" ? "border border-brand text-brand" : "bg-brand text-brand-contrast"
      }`}
    >
      {label}
    </button>
  );
}
