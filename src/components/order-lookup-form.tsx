"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { Locale } from "@/lib/i18n/dictionaries";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { lookupOrderAction, type LookupState } from "@/server/public-actions";
import { Alert, Button, Field, Input } from "./ui";
import { AlertIcon, SearchIcon } from "./ui/icons";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} block>
      <SearchIcon />
      {label}
    </Button>
  );
}

/**
 * Order number plus phone — the way back in from a device that never held the
 * tracking link.
 *
 * A plain form with a server action, so it works before hydration: someone
 * standing outside the restaurant on a bad connection is exactly the person
 * who needs this, and they should not be waiting on a JavaScript bundle.
 */
export function OrderLookupForm({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  const [state, formAction] = useActionState<LookupState, FormData>(lookupOrderAction, {});

  const message =
    state.error === "rate_limited"
      ? t.track.lookupRateLimited
      : state.error === "not_found"
        ? t.track.lookupNotFound
        : state.error === "invalid"
          ? t.track.lookupInvalid
          : null;

  return (
    <form action={formAction} className="space-y-4">
      {message ? (
        <Alert tone="danger" icon={<AlertIcon />}>
          {message}
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.track.reference} htmlFor="lookup-reference" required>
          <Input
            id="lookup-reference"
            name="reference"
            required
            maxLength={32}
            autoComplete="off"
            spellCheck={false}
            dir="ltr"
            placeholder={t.track.referencePlaceholder}
          />
        </Field>
        <Field label={t.track.phone} htmlFor="lookup-phone" required>
          <Input
            id="lookup-phone"
            name="phone"
            required
            type="tel"
            inputMode="tel"
            maxLength={20}
            autoComplete="tel"
            dir="ltr"
            placeholder={t.track.phonePlaceholder}
          />
        </Field>
      </div>

      <SubmitButton label={t.track.lookupCta} />
    </form>
  );
}
