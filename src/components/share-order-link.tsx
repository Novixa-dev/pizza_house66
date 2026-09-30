"use client";

import { useState } from "react";
import { Button } from "./ui";
import { CheckIcon, ReceiptIcon, WhatsappIcon } from "./ui/icons";

/**
 * Two ways to keep the tracking link: copy it, or send it to yourself on
 * WhatsApp.
 *
 * The WhatsApp one is not decoration here. In Yemen WhatsApp is where a phone
 * number's messages actually live, and "send myself the link" is a habit
 * people already have — it survives clearing the browser, changing phones, and
 * handing collection to whoever is nearest the shop.
 */
export function ShareOrderLink({
  url,
  reference,
  copyLabel,
  copiedLabel,
  whatsappLabel,
  whatsappMessage,
}: {
  url: string;
  reference: string;
  copyLabel: string;
  copiedLabel: string;
  whatsappLabel: string;
  whatsappMessage: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard access is refused outside a secure context and in some
      // in-app browsers. The link is on screen either way.
    }
  }

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(`${whatsappMessage} ${reference}\n${url}`)}`;

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="secondary" size="sm" onClick={copy}>
        {copied ? <CheckIcon /> : <ReceiptIcon />}
        {copied ? copiedLabel : copyLabel}
      </Button>
      <a
        href={whatsappHref}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-sm)] border border-line-strong px-3.5 text-sm font-semibold text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink"
      >
        <WhatsappIcon />
        {whatsappLabel}
      </a>
    </div>
  );
}
