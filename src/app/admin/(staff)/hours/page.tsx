import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth";
import { getLocale, pick } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getRestaurant } from "@/server/restaurant";
import { formatDate } from "@/lib/time";
import {
  addScheduleOverrideAction,
  deleteScheduleOverrideAction,
  saveBusinessHoursAction,
} from "@/server/admin-actions";
import { Alert, Card, Checkbox, Field, Input, SectionHeading } from "@/components/ui";
import { InfoIcon, TrashIcon } from "@/components/ui/icons";
import { SubmitButton } from "@/components/admin/submit-button";
import { AdminForm } from "@/components/admin/admin-form";

export const dynamic = "force-dynamic";

export default async function AdminHoursPage() {
  await requirePagePermission("hours.manage");
  const locale = await getLocale();
  const t = getDictionary(locale);
  const restaurant = await getRestaurant();

  const overrides = await prisma.scheduleOverride.findMany({
    where: { restaurantId: restaurant.id },
    orderBy: { date: "asc" },
  });

  const byDay = new Map(restaurant.businessHours.map((hour) => [hour.dayOfWeek, hour]));

  return (
    <div className="space-y-6">
      <SectionHeading
        level={1}
        title={t.hours.title}
        subtitle={`${t.settings.timezone}: ${restaurant.timezone}`}
      />

      <Alert tone="info" icon={<InfoIcon />}>
        {t.hours.overnightHint}
      </Alert>

      <Card className="p-5">
        <AdminForm locale={locale} action={saveBusinessHoursAction} className="space-y-3">
          {Array.from({ length: 7 }, (_, dayOfWeek) => {
            const hour = byDay.get(dayOfWeek);
            return (
              <div
                key={dayOfWeek}
                className="grid items-end gap-3 border-b border-line pb-3 last:border-0 sm:grid-cols-4"
              >
                <p className="font-semibold text-ink sm:pb-3">{t.hours.days[dayOfWeek]}</p>
                <Field label={t.hours.opens} htmlFor={`opensAt-${dayOfWeek}`}>
                  <Input
                    id={`opensAt-${dayOfWeek}`}
                    name={`opensAt-${dayOfWeek}`}
                    type="time"
                    dir="ltr"
                    defaultValue={hour?.opensAt ?? "16:00"}
                  />
                </Field>
                <Field label={t.hours.closes} htmlFor={`closesAt-${dayOfWeek}`}>
                  <Input
                    id={`closesAt-${dayOfWeek}`}
                    name={`closesAt-${dayOfWeek}`}
                    type="time"
                    dir="ltr"
                    defaultValue={hour?.closesAt ?? "00:00"}
                  />
                </Field>
                <div className="pb-3">
                  <Checkbox
                    name={`closed-${dayOfWeek}`}
                    label={t.hours.closed}
                    defaultChecked={hour?.closed ?? false}
                  />
                </div>
              </div>
            );
          })}
          <SubmitButton label={t.common.save} />
        </AdminForm>
      </Card>

      <section>
        <SectionHeading title={t.hours.overrides} />

        {overrides.length === 0 ? (
          <p className="mb-4 text-sm text-ink-muted">{t.hours.noOverrides}</p>
        ) : (
          <ul className="mb-4 space-y-2">
            {overrides.map((override) => (
              <Card as="li" key={override.id} className="flex items-center justify-between gap-4 p-4">
                <div>
                  <p className="numeric font-semibold text-ink">
                    {formatDate(override.date, "UTC", locale)}
                  </p>
                  <p className="text-sm text-ink-muted">
                    {override.closed
                      ? t.hours.closed
                      : `${override.opensAt} – ${override.closesAt}`}
                    {pick(locale, override.reasonAr, override.reasonEn)
                      ? ` · ${pick(locale, override.reasonAr, override.reasonEn)}`
                      : ""}
                  </p>
                </div>
                <AdminForm locale={locale} action={deleteScheduleOverrideAction}>
                  <input type="hidden" name="id" value={override.id} />
                  <button
                    type="submit"
                    aria-label={t.common.delete}
                    className="rounded-[var(--radius-sm)] p-2 text-danger hover:bg-danger-soft"
                  >
                    <TrashIcon />
                  </button>
                </AdminForm>
              </Card>
            ))}
          </ul>
        )}

        <Card className="p-5">
          <h3 className="mb-4 font-bold text-ink">{t.hours.addOverride}</h3>
          <AdminForm locale={locale} action={addScheduleOverrideAction} className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:items-end">
            <Field label={t.hours.overrideDate} htmlFor="override-date" required>
              <Input id="override-date" name="date" type="date" dir="ltr" required />
            </Field>
            <Field label={t.hours.opens} htmlFor="override-opens">
              <Input id="override-opens" name="opensAt" type="time" dir="ltr" defaultValue="16:00" />
            </Field>
            <Field label={t.hours.closes} htmlFor="override-closes">
              <Input id="override-closes" name="closesAt" type="time" dir="ltr" defaultValue="00:00" />
            </Field>
            <Field label={t.hours.overrideReason} htmlFor="override-reason">
              <Input id="override-reason" name="reasonAr" maxLength={120} />
            </Field>
            <div className="flex items-center gap-3 pb-1">
              <Checkbox name="closed" label={t.hours.closed} defaultChecked />
              <SubmitButton label={t.common.create} />
            </div>
          </AdminForm>
        </Card>
      </section>
    </div>
  );
}
