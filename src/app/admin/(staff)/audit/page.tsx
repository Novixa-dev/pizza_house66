import { requirePagePermission } from "@/lib/auth";
import { getLocale, pick } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getRestaurant } from "@/server/restaurant";
import { listAuditEntries } from "@/server/audit";
import { formatDateTime } from "@/lib/time";
import { Card, EmptyState, SectionHeading } from "@/components/ui";
import { ReceiptIcon } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

/**
 * The activity log (docs/PRD.md §61).
 *
 * Kept to owners because it names who did what: useful for settling a
 * question about a price change or a rejected payment, and exactly the kind
 * of record that should not be casually browsable by everyone.
 */
export default async function AdminAuditPage() {
  await requirePagePermission("audit.read");
  const locale = await getLocale();
  const t = getDictionary(locale);
  const restaurant = await getRestaurant();
  const entries = await listAuditEntries(150);

  return (
    <div className="space-y-6">
      <SectionHeading
        level={1}
        title={t.admin.audit}
        subtitle={pick(
          locale,
          "آخر ١٥٠ عملية إدارية مسجلة.",
          "The 150 most recent staff actions."
        )}
      />

      {entries.length === 0 ? (
        <EmptyState title={t.dashboard.noData} icon={<ReceiptIcon />} />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[46rem] text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-muted">
                <th className="p-3 text-start font-semibold">{t.orders.placed}</th>
                <th className="p-3 text-start font-semibold">{t.payments.reviewedBy}</th>
                <th className="p-3 text-start font-semibold">Action</th>
                <th className="p-3 text-start font-semibold">Entity</th>
                <th className="p-3 text-start font-semibold">Details</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-line last:border-0 align-top">
                  <td className="numeric whitespace-nowrap p-3 text-ink-muted">
                    {formatDateTime(entry.createdAt, restaurant.timezone, locale)}
                  </td>
                  <td className="p-3 text-ink">{entry.actorName ?? "—"}</td>
                  <td className="p-3">
                    <code className="rounded bg-surface-muted px-1.5 py-0.5 text-xs text-ink-soft">
                      {entry.action}
                    </code>
                  </td>
                  <td className="p-3 text-ink-soft">
                    {entry.entity}
                    {entry.entityId ? (
                      <span className="numeric block text-[11px] text-ink-muted">{entry.entityId}</span>
                    ) : null}
                  </td>
                  <td className="p-3">
                    {entry.metadata ? (
                      <pre
                        dir="ltr"
                        className="max-w-sm overflow-x-auto whitespace-pre-wrap break-all rounded bg-surface-muted p-2 text-[11px] text-ink-muted"
                      >
                        {JSON.stringify(entry.metadata, null, 1)}
                      </pre>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
