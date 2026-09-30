"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { rejectPaymentAction, verifyPaymentAction } from "@/server/actions";
import { Alert, Button, Textarea } from "../ui";
import { AlertIcon, CheckIcon, CloseIcon } from "../ui/icons";

/**
 * Approve or reject a transfer payment.
 *
 * Approving is one click; rejecting demands a written reason, because a
 * rejection is what a customer will phone the restaurant about and "rejected"
 * with no explanation is an argument waiting to happen (docs/PRD.md §21 —
 * the reviewer, timestamp and reason all go into the record).
 */
export function PaymentReviewActions({
  paymentId,
  verifyLabel,
  rejectLabel,
  reasonLabel,
  reasonPlaceholder,
  cancelLabel,
  locale,
}: {
  paymentId: string;
  verifyLabel: string;
  rejectLabel: string;
  reasonLabel: string;
  reasonPlaceholder: string;
  cancelLabel: string;
  locale: "ar" | "en";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handle(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(
          result.error === "CONCURRENT_UPDATE"
            ? locale === "ar"
              ? "تم تحديث هذا الدفع من جهاز آخر. حدّث الصفحة."
              : "Another device updated this payment. Reload the page."
            : locale === "ar"
              ? "تعذر تنفيذ العملية."
              : "That action could not be completed."
        );
        return;
      }
      setRejecting(false);
      setReason("");
      router.refresh();
    });
  }

  if (rejecting) {
    return (
      <div className="space-y-3">
        <label htmlFor={`reason-${paymentId}`} className="block text-sm font-semibold text-ink">
          {reasonLabel}
        </label>
        <Textarea
          id={`reason-${paymentId}`}
          rows={2}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder={reasonPlaceholder}
          maxLength={300}
        />
        {error ? (
          <Alert tone="danger" icon={<AlertIcon />}>
            {error}
          </Alert>
        ) : null}
        <div className="flex gap-2">
          <Button
            variant="danger"
            size="sm"
            disabled={pending || reason.trim().length < 3}
            onClick={() => handle(() => rejectPaymentAction(paymentId, reason))}
          >
            {rejectLabel}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setRejecting(false)} disabled={pending}>
            <CloseIcon />
            {cancelLabel}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error ? (
        <Alert tone="danger" icon={<AlertIcon />}>
          {error}
        </Alert>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="success"
          size="sm"
          disabled={pending}
          onClick={() => handle(() => verifyPaymentAction(paymentId))}
        >
          <CheckIcon />
          {verifyLabel}
        </Button>
        <Button variant="secondary" size="sm" disabled={pending} onClick={() => setRejecting(true)}>
          {rejectLabel}
        </Button>
      </div>
    </div>
  );
}
