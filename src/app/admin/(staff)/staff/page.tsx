import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth";
import { getLocale, pick } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getRestaurant } from "@/server/restaurant";
import { formatDateTime } from "@/lib/time";
import { permissionsFor } from "@/lib/permissions";
import { deleteStaffAction, saveStaffAction } from "@/server/admin-actions";
import { Alert, Badge, Card, Checkbox, Field, Input, SectionHeading, Select } from "@/components/ui";
import { InfoIcon, TrashIcon } from "@/components/ui/icons";
import { SubmitButton } from "@/components/admin/submit-button";
import { AdminForm } from "@/components/admin/admin-form";

export const dynamic = "force-dynamic";

const ROLES: Role[] = ["OWNER", "MANAGER", "CASHIER", "KITCHEN"];

export default async function AdminStaffPage() {
  const session = await requirePagePermission("staff.manage");
  const locale = await getLocale();
  const t = getDictionary(locale);
  const restaurant = await getRestaurant();

  const users = await prisma.user.findMany({ orderBy: [{ role: "asc" }, { name: "asc" }] });

  return (
    <div className="space-y-6">
      <SectionHeading level={1} title={t.staff.title} />

      <Alert tone="info" icon={<InfoIcon />}>
        {pick(
          locale,
          "لكل دور صلاحيات محددة، ويتم التحقق منها في الخادم لكل عملية — إخفاء الزر وحده ليس حماية.",
          "Each role carries a fixed set of permissions, checked on the server for every action — hiding a button is not protection."
        )}
      </Alert>

      <ul className="space-y-3">
        {users.map((user) => (
          <Card as="li" key={user.id} className="p-5">
            <AdminForm locale={locale} action={saveStaffAction} className="grid gap-3 lg:grid-cols-6 lg:items-end">
              <input type="hidden" name="id" value={user.id} />
              <Field label={t.staff.name} htmlFor={`name-${user.id}`}>
                <Input id={`name-${user.id}`} name="name" defaultValue={user.name} required />
              </Field>
              <Field label={t.staff.email} htmlFor={`email-${user.id}`}>
                <Input id={`email-${user.id}`} name="email" type="email" dir="ltr" defaultValue={user.email} required />
              </Field>
              <Field label={t.staff.role} htmlFor={`role-${user.id}`}>
                <Select id={`role-${user.id}`} name="role" defaultValue={user.role}>
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {t.roles[role]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t.staff.password} htmlFor={`pw-${user.id}`} hint={t.staff.passwordHint}>
                <Input
                  id={`pw-${user.id}`}
                  name="password"
                  type="password"
                  dir="ltr"
                  autoComplete="new-password"
                  minLength={8}
                  placeholder={t.staff.passwordKeep}
                />
              </Field>
              <div className="pb-3">
                <Checkbox name="active" label={t.staff.active} defaultChecked={user.active} />
              </div>
              <div className="flex items-center gap-2 pb-1">
                <SubmitButton label={t.common.save} variant="secondary" />
              </div>
            </AdminForm>

            {/* Deletion is its own form rather than a second submit button:
                a `formAction` override would bypass the wrapper that renders
                "you can't remove the last owner" back to the user. */}
            {user.id !== session.userId ? (
              <AdminForm locale={locale} action={deleteStaffAction} className="mt-3">
                <input type="hidden" name="id" value={user.id} />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-danger hover:underline"
                >
                  <TrashIcon />
                  {t.common.delete}
                </button>
              </AdminForm>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
              <Badge tone={user.active ? "success" : "neutral"}>{t.roles[user.role]}</Badge>
              <span className="text-xs text-ink-muted">
                {t.staff.lastLogin}:{" "}
                {user.lastLoginAt ? (
                  <span className="numeric">
                    {formatDateTime(user.lastLoginAt, restaurant.timezone, locale)}
                  </span>
                ) : (
                  t.staff.never
                )}
              </span>
              <span className="text-xs text-ink-muted">
                · <span className="numeric">{permissionsFor(user.role).length}</span>{" "}
                {t.staff.permissionsCount}
              </span>
            </div>
          </Card>
        ))}
      </ul>

      <Card className="p-5">
        <h2 className="mb-4 font-bold text-ink">{t.staff.newUser}</h2>
        <AdminForm locale={locale} action={saveStaffAction} className="grid gap-3 lg:grid-cols-6 lg:items-end">
          <Field label={t.staff.name} htmlFor="new-name" required>
            <Input id="new-name" name="name" required />
          </Field>
          <Field label={t.staff.email} htmlFor="new-email" required>
            <Input id="new-email" name="email" type="email" dir="ltr" required />
          </Field>
          <Field label={t.staff.role} htmlFor="new-role">
            <Select id="new-role" name="role" defaultValue="KITCHEN">
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {t.roles[role]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t.staff.password} htmlFor="new-password" hint={t.staff.passwordHint} required>
            <Input
              id="new-password"
              name="password"
              type="password"
              dir="ltr"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </Field>
          <div className="pb-3">
            <Checkbox name="active" label={t.staff.active} defaultChecked />
          </div>
          <div className="pb-1">
            <SubmitButton label={t.common.create} />
          </div>
        </AdminForm>
      </Card>
    </div>
  );
}
