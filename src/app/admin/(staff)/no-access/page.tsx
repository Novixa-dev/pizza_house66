import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/permissions";
import { getLocale, pick } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { buttonClass, Card } from "@/components/ui";
import { AlertIcon } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

export const metadata = { robots: { index: false, follow: false } };

/**
 * Where a signed-in staff member lands when their role doesn't cover a page.
 *
 * Saying so plainly beats a generic error: the person is legitimately logged
 * in, they have simply followed a link meant for someone else, and they need
 * to know it's a permissions matter rather than a fault they should report.
 */
export default async function NoAccessPage({ searchParams }: PageProps<"/admin/no-access">) {
  const session = await requireSession();
  const params = await searchParams;
  const locale = await getLocale();
  const t = getDictionary(locale);

  const permission = Array.isArray(params.permission) ? params.permission[0] : params.permission;
  const home = canAccessAdmin(session.role) ? "/admin" : "/kitchen";

  return (
    <div className="mx-auto max-w-lg py-12">
      <Card className="p-8 text-center">
        <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-[var(--radius-pill)] bg-danger-soft text-xl text-danger">
          <AlertIcon />
        </span>
        <h1 className="mb-2 text-xl font-extrabold tracking-tight text-ink">
          {t.admin.noPermission}
        </h1>
        <p className="mb-6 text-sm text-ink-muted">
          {pick(
            locale,
            `أنت مسجّل الدخول باسم ${session.name} بصلاحية ${t.roles[session.role]}.`,
            `You are signed in as ${session.name} with the ${t.roles[session.role]} role.`
          )}
          {permission ? (
            <>
              {" "}
              <code dir="ltr" className="rounded bg-surface-muted px-1.5 py-0.5 text-xs">
                {permission}
              </code>
            </>
          ) : null}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href={home} className={buttonClass("primary")}>
            {canAccessAdmin(session.role) ? t.admin.dashboard : t.admin.kitchen}
          </Link>
          <form action="/api/auth/logout" method="post">
            <button type="submit" className={buttonClass("secondary")}>
              {t.admin.logout}
            </button>
          </form>
        </div>
      </Card>
    </div>
  );
}
