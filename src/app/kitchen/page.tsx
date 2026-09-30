import { redirect } from "next/navigation";
import type { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getLocale, pick } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getRestaurant } from "@/server/restaurant";
import { releaseDueOrders } from "@/server/orders";
import { KITCHEN_BOARD_STATUSES } from "@/lib/order-state";
import { KitchenBoard } from "@/components/kitchen/board";

export const dynamic = "force-dynamic";

/**
 * The kitchen display.
 *
 * Optimized for one thing: someone with flour on their hands glancing at a
 * tablet across the room. Big type, three columns, one button per card, no
 * navigation to get lost in (docs/PRD.md §25).
 *
 * `releaseDueOrders()` runs on every load so the board is correct even if the
 * scheduled job is not configured — the screen that most needs to be right
 * about timing does not depend on external infrastructure being wired up.
 */
export default async function KitchenPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login?next=/kitchen");
  if (!can(session.role, "kitchen.read")) redirect("/admin");

  await releaseDueOrders();

  const locale = await getLocale();
  const t = getDictionary(locale);
  const restaurant = await getRestaurant();
  const now = new Date();

  const [board, upcoming] = await Promise.all([
    prisma.order.findMany({
      where: { status: { in: KITCHEN_BOARD_STATUSES } },
      orderBy: [{ requestedPickupAt: "asc" }],
      include: { items: { include: { options: true } } },
    }),
    // Scheduled orders that haven't reached their kitchen-release time yet.
    // Showing them (greyed, with a countdown) lets the kitchen plan without
    // tempting anyone to start early (docs/PROJECT_ORIGIN.md §20).
    prisma.order.findMany({
      where: { status: "CONFIRMED", kitchenReleaseAt: { gt: now } },
      orderBy: { kitchenReleaseAt: "asc" },
      take: 8,
      include: { items: { include: { options: true } } },
    }),
  ]);

  const serialize = (orders: typeof board) =>
    orders.map((order) => ({
      id: order.id,
      reference: order.reference,
      status: order.status as OrderStatus,
      guestName: order.guestName,
      notes: order.notes,
      requestedPickupAt: order.requestedPickupAt.toISOString(),
      kitchenReleaseAt: order.kitchenReleaseAt.toISOString(),
      preparingAt: order.preparingAt?.toISOString() ?? null,
      readyAt: order.readyAt?.toISOString() ?? null,
      pickupMode: order.pickupMode,
      items: order.items.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        name: pick(locale, item.nameAr, item.nameEn),
        note: item.note,
        options: item.options.map((option) => pick(locale, option.nameAr, option.nameEn)),
      })),
    }));

  return (
    <KitchenBoard
      locale={locale}
      timeZone={restaurant.timezone}
      staffName={session.name}
      canUpdate={can(session.role, "kitchen.update")}
      canOpenAdmin={can(session.role, "dashboard.read")}
      title={t.kitchen.title}
      orders={serialize(board)}
      upcoming={serialize(upcoming)}
    />
  );
}
