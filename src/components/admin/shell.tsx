import Link from "next/link";
import Image from "next/image";
import type { Locale } from "@/lib/i18n/dictionaries";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { otherLocale } from "@/lib/i18n/pick";
import type { Permission } from "@/lib/permissions";
import { Badge } from "../ui";
import {
  CalendarIcon,
  ChartIcon,
  ClockIcon,
  ListIcon,
  LogoutIcon,
  PizzaIcon,
  ReceiptIcon,
  SettingsIcon,
  TagIcon,
  UsersIcon,
  WalletIcon,
} from "../ui/icons";
import { PauseOrderingButton } from "./pause-ordering-button";

export interface AdminNavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  permission: Permission;
  badge?: number;
}

/**
 * The staff shell.
 *
 * Navigation is filtered by the signed-in role's permissions — a kitchen
 * account simply does not see a "Settings" link. That is presentation only:
 * every page behind these links re-checks the permission server-side, because
 * a hidden link is not access control (docs/PRD.md §37).
 */
export function AdminShell({
  locale,
  session,
  pendingPayments,
  orderingPaused,
  currentPath,
  children,
}: {
  locale: Locale;
  session: { name: string; role: "OWNER" | "MANAGER" | "CASHIER" | "KITCHEN"; can: (p: Permission) => boolean };
  pendingPayments: number;
  orderingPaused: boolean;
  currentPath: string;
  children: React.ReactNode;
}) {
  const t = getDictionary(locale);

  const items: AdminNavItem[] = ([
    { href: "/admin", label: t.admin.dashboard, icon: <ChartIcon />, permission: "dashboard.read" },
    { href: "/admin/orders", label: t.admin.orders, icon: <ListIcon />, permission: "orders.read" },
    {
      href: "/admin/payments",
      label: t.admin.payments,
      icon: <WalletIcon />,
      permission: "payments.read",
      badge: pendingPayments,
    },
    { href: "/kitchen", label: t.admin.kitchen, icon: <ClockIcon />, permission: "kitchen.read" },
    { href: "/admin/products", label: t.admin.products, icon: <PizzaIcon />, permission: "products.read" },
    { href: "/admin/categories", label: t.admin.categories, icon: <ListIcon />, permission: "categories.manage" },
    { href: "/admin/promotions", label: t.admin.promotions, icon: <TagIcon />, permission: "promotions.manage" },
    { href: "/admin/customers", label: t.admin.customers, icon: <UsersIcon />, permission: "customers.read" },
    { href: "/admin/reports", label: t.admin.reports, icon: <ChartIcon />, permission: "reports.read" },
    { href: "/admin/hours", label: t.admin.hours, icon: <CalendarIcon />, permission: "hours.manage" },
    { href: "/admin/settings", label: t.admin.settings, icon: <SettingsIcon />, permission: "settings.read" },
    { href: "/admin/staff", label: t.admin.staff, icon: <UsersIcon />, permission: "staff.manage" },
    { href: "/admin/audit", label: t.admin.audit, icon: <ReceiptIcon />, permission: "audit.read" },
  ] satisfies AdminNavItem[]).filter((item) => session.can(item.permission));

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="border-b border-line bg-surface lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-e">
        <div className="flex items-center justify-between gap-3 px-4 py-4 lg:px-5">
          <Link href="/admin" className="flex items-center gap-2.5 font-extrabold text-ink">
            <Image src="/brand/logo.svg" alt="" width={30} height={30} />
            <span className="text-sm">{t.admin.title}</span>
          </Link>
          <form action="/api/locale" method="post">
            <input type="hidden" name="locale" value={otherLocale(locale)} />
            <input type="hidden" name="redirectTo" value={currentPath} />
            <button
              type="submit"
              lang={otherLocale(locale)}
              className="rounded-[var(--radius-sm)] border border-line-strong px-2 py-1 text-xs font-bold text-ink-soft hover:bg-surface-muted"
            >
              {t.common.language}
            </button>
          </form>
        </div>

        <nav
          aria-label={t.admin.title}
          className="scroll-row flex gap-1 border-t border-line px-3 py-2 lg:flex-col lg:overflow-visible lg:px-3 lg:py-3"
        >
          {items.map((item) => {
            const active =
              item.href === "/admin"
                ? currentPath === "/admin"
                : currentPath.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-[var(--radius-sm)] px-3 py-2 text-sm font-semibold transition-colors ${
                  active
                    ? "bg-brand-soft text-brand"
                    : "text-ink-soft hover:bg-surface-muted hover:text-ink"
                }`}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
                {item.badge ? (
                  <span className="numeric ms-auto rounded-[var(--radius-pill)] bg-brand px-1.5 py-0.5 text-[10px] font-extrabold text-brand-ink">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="hidden border-t border-line p-4 lg:block">
          <p className="text-sm font-bold text-ink">{session.name}</p>
          <p className="mb-3 text-xs text-ink-muted">{t.roles[session.role]}</p>
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-line-strong px-3 py-2 text-sm font-semibold text-ink-soft hover:bg-surface-muted"
            >
              <LogoutIcon className="rtl:-scale-x-100" />
              {t.admin.logout}
            </button>
          </form>
        </div>
      </aside>

      <div className="min-w-0 flex-1 bg-page">
        <div className="flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3 lg:px-8">
          <div className="flex items-center gap-3">
            {orderingPaused ? (
              <Badge tone="danger">{t.admin.orderingPausedBanner}</Badge>
            ) : (
              <Badge tone="success">{t.common.openNow}</Badge>
            )}
          </div>
          <div className="flex items-center gap-3">
            {session.can("ordering.pause") ? (
              <PauseOrderingButton
                paused={orderingPaused}
                pauseLabel={t.admin.pauseOrdering}
                resumeLabel={t.admin.resumeOrdering}
              />
            ) : null}
            <form action="/api/auth/logout" method="post" className="lg:hidden">
              <button
                type="submit"
                aria-label={t.admin.logout}
                className="rounded-[var(--radius-sm)] border border-line-strong p-2 text-ink-soft"
              >
                <LogoutIcon className="rtl:-scale-x-100" />
              </button>
            </form>
          </div>
        </div>

        <main id="main" className="p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
