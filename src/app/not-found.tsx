import Link from "next/link";
import Image from "next/image";
import { getLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { buttonClass } from "@/components/ui";

export default async function NotFound() {
  const locale = await getLocale();
  const t = getDictionary(locale);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-16 text-center">
      <Image src="/brand/logo.svg" alt="" width={56} height={56} className="mb-6 opacity-70" />
      <h1 className="mb-2 text-2xl font-extrabold tracking-tight text-ink">{t.errors.notFoundTitle}</h1>
      <p className="mb-8 max-w-sm text-ink-muted">{t.errors.notFoundBody}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/" className={buttonClass("primary")}>
          {t.errors.backHome}
        </Link>
        <Link href="/menu" className={buttonClass("secondary")}>
          {t.common.viewMenu}
        </Link>
      </div>
    </div>
  );
}
