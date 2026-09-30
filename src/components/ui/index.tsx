// Shared UI primitives.
//
// These are the only place raw Tailwind colour/spacing decisions live for
// buttons, cards, badges and form controls. Pages compose them, which is what
// keeps the customer site, the admin panel and the kitchen display looking
// like one product rather than three (docs/PRD.md §48).
//
// Everything here is a server-compatible component: no hooks, no state. The
// few controls that need interactivity live in their own "use client" files.

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import Link from "next/link";

/* -------------------------------------------------------------------------- */
/* Button                                                                      */
/* -------------------------------------------------------------------------- */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
export type ButtonSize = "sm" | "md" | "lg";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius)] font-semibold " +
  "transition-colors disabled:cursor-not-allowed disabled:opacity-55 " +
  // A 44px minimum touch target on the primary sizes — this is a phone-first
  // ordering flow, often used one-handed (docs/PRD.md §49).
  "select-none";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-brand text-brand-ink hover:bg-brand-hover shadow-[var(--shadow-sm)]",
  secondary: "bg-surface text-ink border border-line-strong hover:bg-surface-muted",
  ghost: "text-ink-soft hover:bg-surface-muted hover:text-ink",
  danger: "bg-danger text-white hover:opacity-90",
  success: "bg-accent text-white hover:opacity-90",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 text-sm",
  md: "min-h-11 px-5 text-[0.95rem]",
  lg: "min-h-13 px-7 text-base",
};

export function buttonClass(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  extra = ""
): string {
  return [BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], extra].filter(Boolean).join(" ");
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
}

export function Button({ variant = "primary", size = "md", block, className = "", ...props }: ButtonProps) {
  return <button className={buttonClass(variant, size, `${block ? "w-full" : ""} ${className}`)} {...props} />;
}

interface ButtonLinkProps {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  className?: string;
  children: ReactNode;
  prefetch?: boolean;
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  block,
  className = "",
  children,
  prefetch,
}: ButtonLinkProps) {
  return (
    <Link
      href={href}
      prefetch={prefetch}
      className={buttonClass(variant, size, `${block ? "w-full" : ""} ${className}`)}
    >
      {children}
    </Link>
  );
}

/* -------------------------------------------------------------------------- */
/* Surfaces                                                                    */
/* -------------------------------------------------------------------------- */

export function Card({
  children,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "article" | "section" | "li";
}) {
  return (
    <Tag
      className={`rounded-[var(--radius)] border border-line bg-surface shadow-[var(--shadow-sm)] ${className}`}
    >
      {children}
    </Tag>
  );
}

export function SectionHeading({
  title,
  subtitle,
  action,
  level = 2,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  level?: 1 | 2 | 3;
}) {
  const Tag = (`h${level}` as const) satisfies "h1" | "h2" | "h3";
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <Tag
          className={
            level === 1
              ? "text-2xl font-extrabold tracking-tight text-ink sm:text-3xl"
              : "text-lg font-bold tracking-tight text-ink sm:text-xl"
          }
        >
          {title}
        </Tag>
        {subtitle ? <p className="mt-1 text-sm text-ink-muted">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Badge                                                                       */
/* -------------------------------------------------------------------------- */

export type BadgeTone = "neutral" | "brand" | "success" | "warning" | "danger" | "info" | "progress";

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: "bg-surface-muted text-ink-soft border-line",
  brand: "bg-brand-soft text-brand border-transparent",
  success: "bg-accent-soft text-accent border-transparent",
  warning: "bg-gold-soft text-gold border-transparent",
  danger: "bg-danger-soft text-danger border-transparent",
  info: "bg-info-soft text-info border-transparent",
  progress: "bg-gold-soft text-gold border-transparent",
};

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border px-2.5 py-1 text-xs font-semibold leading-none ${BADGE_TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Feedback                                                                    */
/* -------------------------------------------------------------------------- */

export function Alert({
  tone = "info",
  title,
  children,
  icon,
}: {
  tone?: "info" | "success" | "warning" | "danger";
  title?: string;
  children?: ReactNode;
  icon?: ReactNode;
}) {
  const tones = {
    info: "bg-info-soft text-info",
    success: "bg-accent-soft text-accent",
    warning: "bg-gold-soft text-gold",
    danger: "bg-danger-soft text-danger",
  } as const;
  return (
    <div
      className={`flex items-start gap-3 rounded-[var(--radius)] p-4 text-sm ${tones[tone]}`}
      // Errors and confirmations must reach a screen reader, not just the eye.
      role={tone === "danger" ? "alert" : "status"}
    >
      {icon ? <span className="mt-0.5 shrink-0 text-base">{icon}</span> : null}
      <div className="min-w-0">
        {title ? <p className="font-bold">{title}</p> : null}
        {children ? <div className={title ? "mt-1" : ""}>{children}</div> : null}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--radius)] border border-dashed border-line-strong bg-surface-muted px-6 py-14 text-center">
      {icon ? <span className="mb-3 text-3xl text-ink-muted">{icon}</span> : null}
      <p className="font-semibold text-ink">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-sm text-ink-muted">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Form controls                                                               */
/* -------------------------------------------------------------------------- */

const CONTROL_BASE =
  "w-full rounded-[var(--radius-sm)] border border-line-strong bg-surface px-3.5 py-2.5 text-ink " +
  "placeholder:text-ink-muted/70 transition-colors focus:border-brand disabled:opacity-60";

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className = "",
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
        {required ? (
          <span className="ms-1 text-brand" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {children}
      {hint && !error ? <p className="mt-1.5 text-xs text-ink-muted">{hint}</p> : null}
      {error ? (
        <p className="mt-1.5 text-xs font-semibold text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${CONTROL_BASE} ${className}`} {...props} />;
}

export function Textarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${CONTROL_BASE} ${className}`} {...props} />;
}

export function Select({ className = "", children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${CONTROL_BASE} ${className}`} {...props}>
      {children}
    </select>
  );
}

export function Checkbox({
  label,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className={`flex items-center gap-2.5 text-sm font-medium text-ink ${className}`}>
      <input
        type="checkbox"
        className="h-4.5 w-4.5 shrink-0 rounded border-line-strong accent-[var(--brand)]"
        {...props}
      />
      {label}
    </label>
  );
}

/* -------------------------------------------------------------------------- */
/* Data display                                                                */
/* -------------------------------------------------------------------------- */

export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: BadgeTone;
  icon?: ReactNode;
}) {
  const accents: Record<BadgeTone, string> = {
    neutral: "text-ink",
    brand: "text-brand",
    success: "text-accent",
    warning: "text-gold",
    danger: "text-danger",
    info: "text-info",
    progress: "text-gold",
  };
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
        {icon ? <span className={`text-lg ${accents[tone]}`}>{icon}</span> : null}
      </div>
      <p className={`numeric mt-2 text-2xl font-extrabold ${accents[tone]}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-ink-muted">{hint}</p> : null}
    </Card>
  );
}

export function DescriptionRow({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="text-sm text-ink-muted">{term}</dt>
      <dd className="text-end text-sm font-semibold text-ink">{children}</dd>
    </div>
  );
}

export function Divider({ className = "" }: { className?: string }) {
  return <hr className={`border-0 border-t border-line ${className}`} />;
}
