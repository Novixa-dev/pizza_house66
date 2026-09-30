import Link from "next/link";
import { requirePagePermission } from "@/lib/auth";
import { getLocale, pick } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { formatMoney, formatPercent } from "@/lib/money";
import { getReportSummary, rangeForPreset } from "@/server/admin-queries";
import { Card, EmptyState, SectionHeading, StatCard } from "@/components/ui";
import { ChartIcon, ListIcon, WalletIcon } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

const PRESETS = ["today", "7d", "30d"] as const;
type Preset = (typeof PRESETS)[number];

export default async function AdminReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  await requirePagePermission("reports.read");
  const params = await searchParams;
  const locale = await getLocale();
  const t = getDictionary(locale);

  const rawPreset = Array.isArray(params.range) ? params.range[0] : params.range;
  const preset: Preset = PRESETS.includes(rawPreset as Preset) ? (rawPreset as Preset) : "7d";
  const summary = await getReportSummary(rangeForPreset(preset));

  const money = (minor: number) => formatMoney(minor, summary.currency, locale);
  const presetLabel: Record<Preset, string> = {
    today: t.reports.today,
    "7d": t.reports.last7,
    "30d": t.reports.last30,
  };

  const funnelSteps = [
    { label: t.reports.funnelVisitors, value: summary.funnel.visitors },
    { label: t.reports.funnelMenu, value: summary.funnel.menuViews },
    { label: t.reports.funnelProduct, value: summary.funnel.productViews },
    { label: t.reports.funnelCart, value: summary.funnel.addToCart },
    { label: t.reports.funnelCheckout, value: summary.funnel.checkoutStarted },
    { label: t.reports.funnelOrders, value: summary.funnel.orders },
  ];
  const funnelMax = Math.max(1, ...funnelSteps.map((step) => step.value));
  const peakMax = Math.max(1, ...summary.peakHours.map((hour) => hour.count));

  return (
    <div className="space-y-8">
      <SectionHeading
        level={1}
        title={t.reports.title}
        action={
          <div className="flex gap-2">
            {PRESETS.map((value) => (
              <Link
                key={value}
                href={`/admin/reports?range=${value}`}
                aria-current={preset === value ? "true" : undefined}
                className={`rounded-[var(--radius-pill)] border px-3.5 py-1.5 text-sm font-bold ${
                  preset === value
                    ? "border-brand bg-brand text-brand-ink"
                    : "border-line-strong bg-surface text-ink-soft hover:bg-surface-muted"
                }`}
              >
                {presetLabel[value]}
              </Link>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t.reports.orders} value={String(summary.orders)} icon={<ListIcon />} />
        <StatCard label={t.reports.revenue} value={money(summary.revenueMinor)} tone="success" icon={<WalletIcon />} />
        <StatCard label={t.reports.avgOrderValue} value={money(summary.avgOrderValueMinor)} />
        <StatCard
          label={t.reports.completionRate}
          value={formatPercent(summary.completionRate, locale)}
          tone="success"
        />
        <StatCard
          label={t.reports.cancellationRate}
          value={formatPercent(summary.cancellationRate, locale)}
          tone={summary.cancellationRate > 0.1 ? "danger" : "neutral"}
        />
        <StatCard
          label={t.reports.repeatCustomers}
          value={formatPercent(summary.repeatCustomerRate, locale)}
          tone="info"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <SectionHeading title={t.reports.funnel} />
          <Card className="p-5">
            {/* A horizontal bar per step. Deliberately plain: this is a
                restaurant's weekly read, not a BI product. */}
            <p className="mb-4 text-xs text-ink-muted">{t.reports.funnelNote}</p>
            <ol className="space-y-3">
              {funnelSteps.map((step) => (
                <li key={step.label}>
                  <div className="mb-1 flex items-baseline justify-between text-sm">
                    <span className="text-ink-soft">{step.label}</span>
                    <span className="numeric font-bold text-ink">{step.value}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-[var(--radius-pill)] bg-surface-muted">
                    <div
                      className="h-full rounded-[var(--radius-pill)] bg-brand"
                      style={{ width: `${Math.round((step.value / funnelMax) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </section>

        <section>
          <SectionHeading title={t.reports.topProducts} />
          <Card className="p-5">
            {summary.topProducts.length === 0 ? (
              <p className="text-sm text-ink-muted">{t.reports.noData}</p>
            ) : (
              <ol className="space-y-2.5">
                {summary.topProducts.map((product, index) => (
                  <li key={product.name} className="flex items-center gap-3 text-sm">
                    <span className="numeric w-5 shrink-0 font-bold text-ink-muted">{index + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-ink">
                      {pick(locale, product.nameAr, product.name)}
                    </span>
                    <span className="numeric shrink-0 text-ink-muted">×{product.quantity}</span>
                    <span className="numeric w-24 shrink-0 text-end font-bold text-ink">
                      {money(product.revenueMinor)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </section>

        <section>
          <SectionHeading title={t.reports.peakHours} />
          <Card className="p-5">
            {summary.peakHours.length === 0 ? (
              <p className="text-sm text-ink-muted">{t.reports.noData}</p>
            ) : (
              <ul className="flex items-end gap-1.5" aria-label={t.reports.peakHours}>
                {summary.peakHours.map((hour) => (
                  <li key={hour.hour} className="flex flex-1 flex-col items-center gap-1">
                    <span className="numeric text-[10px] font-bold text-ink-muted">{hour.count}</span>
                    <div
                      className="w-full rounded-t-[var(--radius-sm)] bg-brand"
                      style={{ height: `${Math.max(4, Math.round((hour.count / peakMax) * 96))}px` }}
                    />
                    <span className="numeric text-[10px] text-ink-muted">{hour.hour}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>

        <section>
          <SectionHeading title={t.reports.paymentMix} />
          <Card className="space-y-4 p-5">
            <dl className="space-y-1.5 text-sm">
              {summary.paymentMix.map((row) => (
                <div key={row.method} className="flex justify-between">
                  <dt className="text-ink-soft">{t.paymentMethod[row.method]}</dt>
                  <dd className="numeric font-bold text-ink">{row.count}</dd>
                </div>
              ))}
              {summary.paymentMix.length === 0 ? (
                <p className="text-ink-muted">{t.reports.noData}</p>
              ) : null}
            </dl>
            <div className="border-t border-line pt-3">
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-ink-muted">
                {t.reports.pickupMix}
              </p>
              <dl className="space-y-1.5 text-sm">
                {summary.pickupMix.map((row) => (
                  <div key={row.mode} className="flex justify-between">
                    <dt className="text-ink-soft">
                      {row.mode === "SCHEDULED" ? t.orders.scheduled : t.orders.asap}
                    </dt>
                    <dd className="numeric font-bold text-ink">{row.count}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </Card>
        </section>
      </div>

      {summary.orders === 0 ? <EmptyState title={t.reports.noData} icon={<ChartIcon />} /> : null}
    </div>
  );
}
