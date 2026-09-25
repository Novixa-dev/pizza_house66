"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { ActionState } from "@/server/admin-actions";
import type { Locale } from "@/lib/i18n/dictionaries";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { Alert } from "../ui";
import { AlertIcon, CheckIcon } from "../ui/icons";

// Error codes the admin actions return, in both languages. Keeping them here
// rather than in the actions means the server never has to know which
// language the staff member is reading — it returns a code, this renders it.
const MESSAGES: Record<string, { ar: string; en: string }> = {
  FORBIDDEN: {
    ar: "لا تملك صلاحية تنفيذ هذه العملية.",
    en: "You don't have permission to do that.",
  },
  VALIDATION_ERROR: {
    ar: "تحقق من الحقول المميزة.",
    en: "Please check the highlighted fields.",
  },
  DUPLICATE: {
    ar: "توجد سجل بنفس المعرّف أو الكود بالفعل.",
    en: "A record with that identifier or code already exists.",
  },
  IN_USE: {
    ar: "هذا العنصر مستخدم في سجلات أخرى ولا يمكن حذفه.",
    en: "This item is referenced elsewhere and can't be deleted.",
  },
  CATEGORY_HAS_PRODUCTS: {
    ar: "لا يمكن حذف قسم يحتوي على منتجات.",
    en: "A category that still has products can't be deleted.",
  },
  PRODUCT_IN_USE: {
    ar: "لا يمكن حذف منتج مرتبط بطلبات سابقة — أخفِه بدلًا من ذلك.",
    en: "A product used by past orders can't be deleted — hide it instead.",
  },
  LAST_OWNER: {
    ar: "لا يمكن حذف أو تعطيل آخر حساب مالك.",
    en: "The last owner account can't be removed or deactivated.",
  },
  CANNOT_DELETE_SELF: {
    ar: "لا يمكنك حذف حسابك الحالي.",
    en: "You can't delete your own account.",
  },
  INTERNAL_ERROR: {
    ar: "تعذر تنفيذ العملية. حاول مرة أخرى.",
    en: "That action couldn't be completed. Please try again.",
  },
};

/**
 * A form bound to an admin Server Action.
 *
 * `useActionState` gives the action a `void`-compatible signature while
 * keeping its typed result, so validation failures land as an inline message
 * next to the form instead of throwing the staff member into an error page.
 * The form itself still posts natively if JavaScript hasn't loaded.
 */
export function AdminForm({
  action,
  locale,
  children,
  className,
  resetOnSuccess,
}: {
  action: (form: FormData) => Promise<ActionState>;
  locale: Locale;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const t = getDictionary(locale);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  const [state, formAction] = useActionState(
    async (_previous: ActionState | null, formData: FormData) => action(formData),
    null
  );

  useEffect(() => {
    if (!state?.ok) return;
    // A "create" form should empty itself so the next entry starts clean; an
    // "edit" form should keep showing what was just saved.
    if (resetOnSuccess) formRef.current?.reset();
    router.refresh();
  }, [state, resetOnSuccess, router]);

  const message = state?.error ? MESSAGES[state.error] : null;

  return (
    <form ref={formRef} action={formAction} className={className}>
      {children}

      {state?.error ? (
        <div className="mt-3">
          <Alert tone="danger" icon={<AlertIcon />}>
            {message ? message[locale] : state.error}
            {state.fieldErrors ? (
              <ul className="mt-1 list-inside list-disc text-xs">
                {Object.entries(state.fieldErrors).map(([field, code]) => (
                  <li key={field}>
                    <code dir="ltr">{field}</code>: {code}
                  </li>
                ))}
              </ul>
            ) : null}
          </Alert>
        </div>
      ) : null}

      {state?.ok ? (
        <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-accent" role="status">
          <CheckIcon />
          {t.common.saved}
        </p>
      ) : null}
    </form>
  );
}
