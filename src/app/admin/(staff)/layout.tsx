import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getLocale } from "@/lib/i18n/locale";
import { getRestaurant } from "@/server/restaurant";
import { AdminShell } from "@/components/admin/shell";

export const dynamic = "force-dynamic";

// Guards the whole staff area. The proxy already redirected anyone without a
// valid session; this is the check that actually decides *which* staff may be
// here, because the proxy can only see that a cookie is validly signed.
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  // Kitchen-only accounts have no business in the admin area — send them to
  // the screen they do have rights to rather than showing an empty shell.
  if (!can(session.role, "dashboard.read")) redirect("/kitchen");

  const [locale, restaurant, pendingPayments, headerList] = await Promise.all([
    getLocale(),
    getRestaurant(),
    can(session.role, "payments.read")
      ? prisma.payment.count({ where: { status: "PENDING" } })
      : Promise.resolve(0),
    headers(),
  ]);

  const currentPath = headerList.get("x-pathname") ?? headerList.get("x-invoke-path") ?? "/admin";

  return (
    <AdminShell
      locale={locale}
      session={{
        name: session.name,
        role: session.role,
        can: (permission) => can(session.role, permission),
      }}
      pendingPayments={pendingPayments}
      orderingPaused={restaurant.onlineOrderingPaused}
      currentPath={currentPath}
    >
      {children}
    </AdminShell>
  );
}
