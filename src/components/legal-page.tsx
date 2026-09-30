import type { ReactNode } from "react";
import { SectionHeading } from "./ui";

/**
 * Shared shell for the terms and privacy pages.
 *
 * Both are long prose in two languages, and the only thing they need beyond
 * a heading is a readable measure and honest spacing. Sharing the shell keeps
 * them looking like one document rather than two people's idea of one.
 */
export function LegalPage({
  title,
  lead,
  updated,
  updatedLabel,
  children,
}: {
  title: string;
  lead: string;
  updated: string;
  updatedLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="container-page max-w-2xl py-10">
      <SectionHeading level={1} title={title} subtitle={lead} />
      <p className="numeric -mt-4 mb-8 text-xs text-ink-muted">
        {updatedLabel}: {updated}
      </p>
      <div className="space-y-6 leading-relaxed text-ink-soft [&_h2]:mb-2 [&_h2]:mt-8 [&_h2]:font-bold [&_h2]:text-ink [&_li]:mb-1.5 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:ps-6">
        {children}
      </div>
    </div>
  );
}
