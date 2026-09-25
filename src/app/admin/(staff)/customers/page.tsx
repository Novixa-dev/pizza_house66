import { requirePagePermission } from "@/lib/auth";
import { getLocale, pick } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/time";
import { getRestaurant } from "@/server/restaurant";
import { listCustomers } from "@/server/admin-queries";
import { Card, EmptyState, SectionHeading } from "@/components/ui";
import { UsersIcon } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

/**
 * Customer list.
 *
 * Deliberately thin: a name, a phone number and an order history is all the
 * restaurant needs to recognize a regular or chase a no-show. No marketing
 * profile, no behavioural data — the product collects what it uses
 * (docs/PRD.md §35, §52 "do not collect unnecessary personal information").
 */
export default async function AdminCustomersPage() {
  await requirePagePermission("customers.read");
  const locale = await getLocale();
  const t = getDictionary(locale);
  const restaurant = await getRestaurant();
  const customers = await listCustomers();

  return (
    <div className="space-y-6">
      <SectionHeading level={1} title={t.customers.title} subtitle={`${customers.length}`} />

      {customers.length === 0 ? (
        <EmptyState title={t.customers.empty} icon={<UsersIcon />} />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-muted">
                <th className="p-3 text-start font-semibold">{t.customers.name}</th>
                <th className="p-3 text-start font-semibold">{t.customers.phone}</th>
                <th className="p-3 text-end font-semibold">{t.customers.orderCount}</th>
                <th className="p-3 text-end font-semibold">{t.customers.totalSpent}</th>
                <th className="p-3 text-start font-semibold">{t.customers.firstOrder}</th>
                <th className="p-3 text-start font-semibold">{t.customers.lastOrder}</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id} className="border-b border-line last:border-0">
                  <td className="p-3 font-semibold text-ink">{customer.name}</td>
                  <td className="p-3">
                    <a href={`tel:${customer.phone}`} className="numeric text-brand hover:underline">
                      {customer.phone}
                    </a>
                  </td>
                  <td className="numeric p-3 text-end text-ink-soft">{customer.orderCount}</td>
                  <td className="numeric p-3 text-end font-bold text-ink">
                    {formatMoney(customer.totalSpentMinor, restaurant.currency, locale)}
                  </td>
                  <td className="numeric p-3 text-ink-muted">
                    {formatDate(customer.firstOrderAt, restaurant.timezone, locale)}
                  </td>
                  <td className="numeric p-3 text-ink-muted">
                    {customer.lastOrderAt
                      ? formatDate(customer.lastOrderAt, restaurant.timezone, locale)
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <p className="text-xs text-ink-muted">
        {pick(
          locale,
          "يُنشأ سجل العميل تلقائيًا من رقم الهاتف عند الطلب — لا حاجة لإنشاء حساب.",
          "Customer records are created automatically from the phone number at checkout — no account required."
        )}
      </p>
    </div>
  );
}
