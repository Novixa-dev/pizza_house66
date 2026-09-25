import type { OrderStatus } from "@prisma/client";
import { CUSTOMER_VISIBLE_LABELS, CUSTOMER_TIMELINE } from "@/lib/order-state";
import { formatTime } from "@/lib/time";
import type { Locale } from "@/lib/i18n/dictionaries";
import { pickValue } from "@/lib/i18n/pick";
import { CheckIcon } from "./ui/icons";

interface HistoryEntry {
  toStatus: OrderStatus;
  createdAt: string;
}

/**
 * The customer's view of progress.
 *
 * It walks the simplified five-step path rather than the internal status
 * list, so a customer never has to wonder what "QUEUED" means versus
 * "CONFIRMED" (docs/PRD.md §27). A terminal failure — rejected, cancelled —
 * replaces the remaining steps rather than leaving a ladder that will never
 * be climbed.
 */
export function OrderTimeline({
  locale,
  timeZone,
  currentStatus,
  history,
}: {
  locale: Locale;
  timeZone: string;
  currentStatus: OrderStatus;
  history: HistoryEntry[];
}) {
  const terminalFailure = (["REJECTED", "CANCELLED", "REFUNDED"] as OrderStatus[]).includes(
    currentStatus
  );

  const reachedAt = new Map<OrderStatus, string>();
  for (const entry of history) {
    if (!reachedAt.has(entry.toStatus)) reachedAt.set(entry.toStatus, entry.createdAt);
  }

  const steps: { status: OrderStatus; at: string | null }[] = terminalFailure
    ? [
        ...CUSTOMER_TIMELINE.filter((status) => reachedAt.has(status)).map((status) => ({
          status,
          at: reachedAt.get(status) ?? null,
        })),
        { status: currentStatus, at: reachedAt.get(currentStatus) ?? null },
      ]
    : CUSTOMER_TIMELINE.map((status) => ({ status, at: reachedAt.get(status) ?? null }));

  const currentIndex = steps.findIndex((step) => step.status === currentStatus);
  const activeIndex =
    currentIndex >= 0
      ? currentIndex
      : // QUEUED and PAYMENT_PENDING aren't on the simplified ladder; show the
        // last step the order actually reached.
        steps.reduce((last, step, index) => (step.at ? index : last), 0);

  return (
    <ol className="relative">
      {steps.map((step, index) => {
        const done = index < activeIndex || Boolean(step.at);
        const isCurrent = index === activeIndex;
        const isFailure =
          terminalFailure && index === steps.length - 1;
        const label = CUSTOMER_VISIBLE_LABELS[step.status];

        return (
          <li key={step.status} className="flex gap-4 pb-6 last:pb-0">
            <div className="relative flex flex-col items-center">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-pill)] border-2 text-sm ${
                  isFailure
                    ? "border-danger bg-danger text-white"
                    : done || isCurrent
                      ? "border-accent bg-accent text-white"
                      : "border-line-strong bg-surface text-ink-muted"
                }`}
                aria-hidden="true"
              >
                {done || isCurrent ? <CheckIcon /> : index + 1}
              </span>
              {index < steps.length - 1 ? (
                <span
                  className={`mt-1 w-0.5 flex-1 ${done && index < activeIndex ? "bg-accent" : "bg-line"}`}
                  aria-hidden="true"
                />
              ) : null}
            </div>

            <div className="min-w-0 pb-1 pt-1">
              <p
                className={`font-semibold ${
                  isFailure ? "text-danger" : isCurrent ? "text-ink" : done ? "text-ink-soft" : "text-ink-muted"
                }`}
              >
                {pickValue(locale, label)}
                {isCurrent ? <span className="sr-only"> — current</span> : null}
              </p>
              {step.at ? (
                <p className="numeric mt-0.5 text-xs text-ink-muted">
                  {formatTime(new Date(step.at), timeZone, locale)}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
