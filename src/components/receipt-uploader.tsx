"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getDictionary, type Locale } from "@/lib/i18n/dictionaries";
import { Alert, Button, Card, Field, Input } from "./ui";
import { AlertIcon, CheckIcon, ReceiptIcon } from "./ui/icons";

const MAX_BYTES = 3 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

/**
 * Lets a customer attach their transfer receipt after the order exists.
 *
 * People routinely place the order, then switch to a banking app to pay, so
 * insisting the receipt is ready at checkout costs orders. The tracking token
 * in the URL is the authorization; the server re-validates the file's type
 * and size from its actual bytes (docs/PRD.md §42).
 */
export function ReceiptUploader({
  locale,
  token,
  currentReference,
}: {
  locale: Locale;
  token: string;
  currentReference: string;
}) {
  const t = getDictionary(locale);
  const router = useRouter();

  const [reference, setReference] = useState(currentReference);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  function onFileChange(next: File | null) {
    setError(null);
    if (!next) {
      setFile(null);
      return;
    }
    if (!ALLOWED.includes(next.type)) {
      setError(t.checkout.receiptWrongType);
      setFile(null);
      return;
    }
    if (next.size > MAX_BYTES) {
      setError(t.checkout.receiptTooLarge);
      setFile(null);
      return;
    }
    setFile(next);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!file || submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const buffer = await file.arrayBuffer();
      const response = await fetch(`/api/orders/${token}/receipt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentType: file.type,
          dataBase64: toBase64(buffer),
          originalName: file.name,
          referenceNumber: reference.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(
          data.error === "RECEIPT_TOO_LARGE"
            ? t.checkout.receiptTooLarge
            : data.error === "RECEIPT_TYPE"
              ? t.checkout.receiptWrongType
              : t.checkout.genericError
        );
        setSubmitting(false);
        return;
      }

      setDone(true);
      router.refresh();
    } catch {
      setError(t.checkout.networkError);
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <Alert tone="success" icon={<CheckIcon />}>
        {t.orderStatus.receiptUploaded}
      </Alert>
    );
  }

  return (
    <Card className="p-5">
      <h2 className="mb-1 flex items-center gap-2 font-bold text-ink">
        <span className="text-brand">
          <ReceiptIcon />
        </span>
        {t.orderStatus.uploadReceiptTitle}
      </h2>
      <p className="mb-4 text-sm text-ink-muted">{t.orderStatus.uploadReceiptHint}</p>

      <form onSubmit={submit} className="space-y-4">
        <Field label={t.checkout.transferReference} htmlFor="upload-reference">
          <Input
            id="upload-reference"
            dir="ltr"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder={t.checkout.transferReferencePlaceholder}
          />
        </Field>

        <Field label={t.checkout.receipt} htmlFor="upload-receipt" hint={t.checkout.receiptHint}>
          <input
            id="upload-receipt"
            type="file"
            accept={ALLOWED.join(",")}
            onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
            className="block w-full text-sm text-ink-soft file:me-3 file:rounded-[var(--radius-sm)] file:border-0 file:bg-brand file:px-4 file:py-2 file:text-sm file:font-semibold file:text-brand-ink"
          />
        </Field>

        {error ? (
          <Alert tone="danger" icon={<AlertIcon />}>
            {error}
          </Alert>
        ) : null}

        <Button type="submit" disabled={!file || submitting}>
          {submitting ? t.checkout.submitting : t.orderStatus.uploadReceiptCta}
        </Button>
      </form>
    </Card>
  );
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
  }
  return btoa(binary);
}
