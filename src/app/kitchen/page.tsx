import { redirect } from "next/navigation";
import { getSession, roleCanAccessKitchen } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { releaseDueOrders } from "@/server/orders";
import { transitionOrderAction } from "@/server/actions";
import type { Order, OrderItem } from "@prisma/client";

export default async function KitchenPage() {
  const session = await getSession();
  if (!session || !roleCanAccessKitchen(session.role)) {
    redirect("/admin/login");
  }

  await releaseDueOrders();

  const orders = await prisma.order.findMany({
    where: { status: { in: ["QUEUED", "PREPARING", "READY"] } },
    orderBy: { kitchenReleaseAt: "asc" },
    include: { items: true },
  });

  const columns: { status: "QUEUED" | "PREPARING" | "READY"; title: string; nextStatus: "PREPARING" | "READY" | "COMPLETED"; actionLabel: string }[] = [
    { status: "QUEUED", title: "Upcoming", nextStatus: "PREPARING", actionLabel: "Start" },
    { status: "PREPARING", title: "Preparing", nextStatus: "READY", actionLabel: "Mark Ready" },
    { status: "READY", title: "Ready", nextStatus: "COMPLETED", actionLabel: "Complete" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between border-b border-border pb-4">
        <h1 className="text-xl font-bold">Kitchen Display</h1>
        <form action="/api/auth/logout" method="post">
          <button type="submit" className="rounded border border-border px-3 py-1 text-sm">
            Log Out
          </button>
        </form>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {columns.map((col) => {
          const columnOrders = orders.filter((o) => o.status === col.status);
          return (
            <div key={col.status}>
              <h2 className="mb-3 font-bold">
                {col.title} ({columnOrders.length})
              </h2>
              <div className="space-y-3">
                {columnOrders.length === 0 && <p className="text-sm text-muted">No orders right now</p>}
                {columnOrders.map((order) => (
                  <KitchenCard key={order.id} order={order} nextStatus={col.nextStatus} actionLabel={col.actionLabel} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KitchenCard({
  order,
  nextStatus,
  actionLabel,
}: {
  order: Order & { items: OrderItem[] };
  nextStatus: "PREPARING" | "READY" | "COMPLETED";
  actionLabel: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-bold">{order.reference}</span>
        <span className="text-xs text-muted">{order.requestedPickupAt.toLocaleTimeString()}</span>
      </div>
      <ul className="mb-2 text-sm">
        {order.items.map((item) => (
          <li key={item.id}>
            {item.quantity}× {item.nameEn}
            {item.note && <span className="text-xs text-muted"> — {item.note}</span>}
          </li>
        ))}
      </ul>
      <form action={transitionOrderAction.bind(null, order.id, nextStatus, undefined)}>
        <button type="submit" className="w-full rounded bg-brand px-3 py-1.5 text-sm font-semibold text-brand-contrast">
          {actionLabel}
        </button>
      </form>
    </div>
  );
}
