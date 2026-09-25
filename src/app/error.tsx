"use client";

import { useEffect } from "react";

// Top-level error boundary.
//
// Production users must never see a stack trace, a database message or an
// internal path (docs/PRD.md §62). The digest is shown because it is the only
// thing that lets someone reporting a problem be matched to a server log
// entry — it carries no detail of its own.
//
// Strings are inlined rather than read from the dictionary: this boundary has
// to render when something upstream (including the locale lookup) has already
// failed.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] unhandled error", error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="mb-2 text-2xl font-extrabold tracking-tight text-ink">
        حدث خطأ غير متوقع
        <span className="mt-1 block text-lg text-ink-soft" lang="en">
          Something went wrong
        </span>
      </h1>
      <p className="mb-8 max-w-sm text-ink-muted">
        حاول مرة أخرى. إذا تكرر الأمر، تواصل مع المطعم.
        <span className="mt-1 block" lang="en">
          Please try again. If it keeps happening, contact the restaurant.
        </span>
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="min-h-11 rounded-[var(--radius)] bg-brand px-6 font-bold text-brand-ink"
        >
          إعادة المحاولة / Try again
        </button>
        {/* A full page load, not a client-side <Link>: this boundary can
            render when the router itself is the thing that failed, and a
            soft navigation would then go nowhere. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/"
          className="min-h-11 rounded-[var(--radius)] border border-line-strong px-6 py-2.5 font-semibold text-ink"
        >
          الرئيسية / Home
        </a>
      </div>
      {error.digest ? (
        <p className="numeric mt-8 text-xs text-ink-muted" dir="ltr">
          Reference: {error.digest}
        </p>
      ) : null}
    </div>
  );
}
