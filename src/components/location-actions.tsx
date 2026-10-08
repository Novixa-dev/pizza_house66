"use client";

import { useRef, useState } from "react";
import { CheckIcon, CopyIcon, NavigationIcon, ShareIcon } from "./ui/icons";

/**
 * What a visitor does with an address: go there, copy it, send it to
 * whoever is coming with them.
 *
 * In Fuwa an address is a description rather than a street, so the useful
 * actions are the ones that hand a precise spot to another app — directions
 * to the pin, the Plus Code for pasting into Maps, and the share sheet for a
 * message to a friend. Every one of them works without this component's
 * JavaScript having run, except copy and share, which need the browser.
 */
export function LocationActions({
  directionsUrl,
  address,
  plusCode,
  shareUrl,
  shareTitle,
  labels,
}: {
  directionsUrl: string | null;
  address: string;
  plusCode: string | null;
  shareUrl: string;
  shareTitle: string;
  labels: {
    directions: string;
    copyAddress: string;
    copyCode: string;
    copied: string;
    share: string;
    plusCode: string;
  };
}) {
  const [copied, setCopied] = useState<"address" | "code" | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function copy(kind: "address" | "code", text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard access can be refused (insecure context, permissions). Fall
      // back to a selection the user can copy by hand rather than silently
      // pretending it worked.
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(area);
      if (!ok) return;
    }
    setCopied(kind);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(null), 2500);
  }

  async function share() {
    // The share sheet where there is one (phones); the link copied where
    // there is not (desktop), so the button always does something.
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: shareTitle, text: address, url: shareUrl });
        return;
      } catch (error) {
        // Dismissing the sheet is not an error worth reporting.
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    await copy("address", `${address}\n${shareUrl}`);
  }

  const button =
    "inline-flex min-h-11 items-center gap-2 rounded-[var(--radius)] border border-line-strong bg-surface px-4 text-sm font-semibold text-ink-soft transition-colors hover:border-brand/40 hover:bg-surface-muted";

  return (
    <div className="space-y-4">
      {plusCode ? (
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{labels.plusCode}</p>
            {/* dir="ltr": a Plus Code is Latin letters and digits; inside an
                RTL page it would otherwise reorder around the "+". */}
            <p className="numeric text-lg font-extrabold tracking-wide text-ink" dir="ltr" data-testid="plus-code">
              {plusCode}
            </p>
          </div>
          <button type="button" onClick={() => copy("code", plusCode)} className={button}>
            {copied === "code" ? <CheckIcon className="text-accent" /> : <CopyIcon />}
            {copied === "code" ? labels.copied : labels.copyCode}
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {directionsUrl ? (
          <a
            href={directionsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius)] bg-brand px-4 text-sm font-semibold text-brand-ink transition-opacity hover:opacity-90"
          >
            <NavigationIcon />
            {labels.directions}
          </a>
        ) : null}
        <button type="button" onClick={() => copy("address", address)} className={button}>
          {copied === "address" ? <CheckIcon className="text-accent" /> : <CopyIcon />}
          {copied === "address" ? labels.copied : labels.copyAddress}
        </button>
        <button type="button" onClick={share} className={button}>
          <ShareIcon />
          {labels.share}
        </button>
      </div>

      {/* Announced to a screen reader; the visible label change is not. */}
      <p className="sr-only" role="status" aria-live="polite">
        {copied ? labels.copied : ""}
      </p>
    </div>
  );
}
