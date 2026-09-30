"use client";

import { useFormStatus } from "react-dom";

/**
 * A submit button that asks before doing something that cannot be undone.
 *
 * The precedent is `pause-ordering-button.tsx`, which asks before pausing
 * ordering and not before resuming, on the reasoning that the consequences
 * are asymmetric. The same reasoning applies harder here: cancelling an order
 * is terminal in the state machine — only a refund follows it — and the
 * button sat one tab-stop from "send to the kitchen now". Deleting a staff
 * account or a category is no more recoverable.
 *
 * `window.confirm` rather than a modal: it cannot be dismissed by accident,
 * it is keyboard- and screen-reader-accessible for free, and it is the same
 * control the rest of the admin already uses. A bespoke dialog here would be
 * a second pattern for one purpose.
 */
export function ConfirmSubmit({
  message,
  children,
  className,
}: {
  /**
   * What is about to happen, phrased so "OK" is an informed answer. Empty
   * submits straight through, so one button in a list can be the guarded one
   * without its neighbours each needing a different component.
   */
  message: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={className}
      onClick={(event) => {
        if (message && !window.confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
