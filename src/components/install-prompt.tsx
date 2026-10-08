"use client";

import { useState, useSyncExternalStore } from "react";
import { CheckIcon, DownloadIcon } from "./ui/icons";

// "Install the app", offered only where it can work.
//
// The site is a PWA (src/app/manifest.ts), but nothing told a customer so:
// installing was a menu item most people never open. Chrome and Edge fire
// `beforeinstallprompt` when the site is installable, and this keeps that
// event so a button of our own can raise the browser's dialog. iOS Safari has
// no such event and cannot be prompted, so there the button shows the two
// taps that do it. Everywhere else — an already-installed app, a browser that
// cannot install — it renders nothing, rather than a button that does not work.

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Mode = "none" | "prompt" | "ios";

let deferred: InstallEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
let started = false;

function emit() {
  for (const listener of listeners) listener();
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as InstallEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    emit();
  });
}

function subscribe(listener: () => void) {
  start();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function snapshot(): Mode {
  if (installed || isStandalone()) return "none";
  if (deferred) return "prompt";
  const ua = navigator.userAgent;
  // iPadOS 13+ reports itself as a Mac, so touch support is the tell there.
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  // Chrome, Firefox and Edge on iOS are Safari underneath and cannot install
  // either, but only Safari's share sheet has "Add to Home Screen" in the
  // place the instructions point to.
  const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return ios && safari ? "ios" : "none";
}

const serverSnapshot = (): Mode => "none";

export function InstallPrompt({
  labels,
}: {
  labels: { install: string; hint: string; ios: string; done: string };
}) {
  const mode = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const [showSteps, setShowSteps] = useState(false);
  const [accepted, setAccepted] = useState(false);

  if (accepted) {
    return (
      <p className="flex items-center gap-2 text-sm font-semibold text-accent" role="status">
        <CheckIcon />
        {labels.done}
      </p>
    );
  }
  if (mode === "none") return null;

  async function install() {
    if (mode === "ios") {
      setShowSteps((value) => !value);
      return;
    }
    const event = deferred;
    if (!event) return;
    await event.prompt();
    const choice = await event.userChoice;
    // The browser lets an event be used once; whatever was chosen, it is spent.
    deferred = null;
    if (choice.outcome === "accepted") setAccepted(true);
    emit();
  }

  return (
    <div data-testid="install-prompt" className="space-y-2">
      <p className="text-sm text-ink-muted">{labels.hint}</p>
      <button
        type="button"
        onClick={install}
        aria-expanded={mode === "ios" ? showSteps : undefined}
        className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius)] border border-line-strong bg-surface px-4 text-sm font-semibold text-ink-soft transition-colors hover:border-brand/40 hover:bg-surface-muted"
      >
        <DownloadIcon className="text-brand" />
        {labels.install}
      </button>
      {mode === "ios" && showSteps ? (
        <p className="rounded-[var(--radius-sm)] bg-surface-muted px-3 py-2 text-sm text-ink-soft" role="note">
          {labels.ios}
        </p>
      ) : null}
    </div>
  );
}
