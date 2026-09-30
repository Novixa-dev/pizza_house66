"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonVariant } from "../ui";

/**
 * A submit button that disables itself while its form is in flight.
 *
 * `useFormStatus` reads the pending state of the enclosing form, which is why
 * this is a separate client component: the form itself stays a server
 * component and keeps working without JavaScript. Blocking the second click
 * is also the last line of defence against a duplicate submission
 * (docs/PRD.md §45).
 */
export function SubmitButton({
  label,
  pendingLabel,
  variant = "primary",
  block,
}: {
  label: string;
  pendingLabel?: string;
  variant?: ButtonVariant;
  block?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending} block={block}>
      {pending ? (pendingLabel ?? `${label}…`) : label}
    </Button>
  );
}
