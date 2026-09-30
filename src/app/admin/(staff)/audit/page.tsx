import { requirePagePermission } from "@/lib/auth";
import { getLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getRestaurant } from "@/server/restaurant";
import { listAuditEntries } from "@/server/audit";
import { formatDateTime } from "@/lib/time";
import { Card, EmptyState, SectionHeading } from "@/components/ui";
import { ReceiptIcon } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

type Dict = ReturnType<typeof getDictionary>;

/** Falls back to the raw key: a new action must never render as a blank cell. */
function actionLabel(t: Dict, action: string): string {
  return (t.audit.actions as Record<string, string>)[action] ?? action;
}

function entityLabel(t: Dict, entity: string): string {
  return (t.audit.entities as Record<string, string>)[entity] ?? entity;
}

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
  const LIMIT = 150;
  const entries = await listAuditEntries(LIMIT);

  return (
    <div className="space-y-6">
      <SectionHeading
        level={1}
        title={t.admin.audit}
        subtitle={t.audit.subtitle.replace("{count}", String(LIMIT))}
      />

      {entries.length === 0 ? (
        <EmptyState title={t.dashboard.noData} icon={<ReceiptIcon />} />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[46rem] text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-muted">
                <th className="p-3 text-start font-semibold">{t.audit.when}</th>
                <th className="p-3 text-start font-semibold">{t.audit.actor}</th>
                <th className="p-3 text-start font-semibold">{t.audit.action}</th>
                <th className="p-3 text-start font-semibold">{t.audit.entity}</th>
                <th className="p-3 text-start font-semibold">{t.audit.details}</th>
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
                    {/* What happened, in words, with the key that produced it
                        underneath: the owner reads the first line, and the
                        second is what makes the entry precise enough to be
                        worth keeping. */}
                    <span className="block font-semibold text-ink">
                      {actionLabel(t, entry.action)}
                    </span>
                    <code
                      dir="ltr"
                      className="mt-0.5 block text-[11px] text-ink-muted"
                    >
                      {entry.action}
                    </code>
                  </td>
                  <td className="p-3 text-ink-soft">
                    {entityLabel(t, entry.entity)}
                    {entry.entityId ? (
                      <code dir="ltr" className="block text-[11px] text-ink-muted">
                        {entry.entityId}
                      </code>
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
