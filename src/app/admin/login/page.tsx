import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/permissions";
import { getLocale, pick } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { Alert, Card, Field, Input } from "@/components/ui";
import { AlertIcon } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Staff login",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage({ searchParams }: PageProps<"/admin/login">) {
  // Already signed in: skip the form rather than making staff log in twice.
  const session = await getSession();
  if (session) redirect(canAccessAdmin(session.role) ? "/admin" : "/kitchen");

  const params = await searchParams;
  const locale = await getLocale();
  const t = getDictionary(locale);

  const error = single(params.error);
  const next = single(params.next) ?? "";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-page px-4 py-12">
      <main id="main" className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Image src="/brand/logo.svg" alt="" width={56} height={56} className="mb-4" />
          <h1 className="text-xl font-extrabold tracking-tight text-ink">{t.admin.loginTitle}</h1>
          <p className="mt-1 text-sm text-ink-muted">{t.common.siteNameFull}</p>
        </div>

        <Card className="p-6">
          <form action="/api/auth/login" method="post" className="space-y-4">
            {/* Only a same-site path survives the server's `safeNext` check. */}
            <input type="hidden" name="next" value={next} />

            <Field label={t.admin.email} htmlFor="email" required>
              <Input
                id="email"
                name="email"
                type="email"
                dir="ltr"
                autoComplete="username"
                required
                autoFocus
              />
            </Field>

            <Field label={t.admin.password} htmlFor="password" required>
              <Input
                id="password"
                name="password"
                type="password"
                dir="ltr"
                autoComplete="current-password"
                required
              />
            </Field>

            {error ? (
              <Alert tone="danger" icon={<AlertIcon />}>
                {error === "rate_limited" ? t.admin.rateLimited : t.admin.invalidCredentials}
              </Alert>
            ) : null}

            <button
              type="submit"
              className="min-h-12 w-full rounded-[var(--radius)] bg-brand font-bold text-brand-ink transition-colors hover:bg-brand-hover"
            >
              {t.admin.signIn}
            </button>
          </form>
        </Card>

        <p className="mt-6 text-center text-sm">
          <Link href="/" className="font-semibold text-ink-muted hover:text-brand">
            {pick(locale, "العودة إلى الموقع", "Back to the site")}
          </Link>
        </p>
      </main>
    </div>
  );
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
