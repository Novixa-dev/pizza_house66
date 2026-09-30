// Remembering an order on the device that placed it.
//
// A guest order has no account behind it, so the tracking link is the only
// way back to it. Handing that link to the customer once, on a page they then
// navigate away from, is not handing it to them at all: the most common
// support message a small restaurant gets is "where is my order?" from
// someone who closed the tab.
//
// So the device keeps a short list. This module is the pure part — parsing,
// merging and pruning — kept out of the component so it can be tested without
// a browser, and so a corrupted or hostile localStorage value can only ever
// produce an empty list rather than a crash on the page that recovers orders.

/** How many orders a device remembers. Older ones fall off the end. */
export const MAX_REMEMBERED = 12;

/** How long an order stays in the list before it is pruned, in days. */
export const REMEMBER_DAYS = 30;

export const STORAGE_KEY = "ph66.orders.v1";

export interface RememberedOrder {
  token: string;
  reference: string;
  /** ISO timestamp of when the order was placed. */
  placedAt: string;
}

function isRememberedOrder(value: unknown): value is RememberedOrder {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.token === "string" &&
    candidate.token.length > 0 &&
    candidate.token.length <= 128 &&
    typeof candidate.reference === "string" &&
    candidate.reference.length > 0 &&
    candidate.reference.length <= 32 &&
    typeof candidate.placedAt === "string" &&
    !Number.isNaN(Date.parse(candidate.placedAt))
  );
}

/**
 * Parses whatever is in storage into a list we are willing to render.
 *
 * Anything unrecognizable is dropped silently rather than thrown: this runs on
 * the page whose entire job is to recover a lost order, and failing loudly
 * there would deny someone the order that *is* still valid because of one that
 * is not.
 */
export function parseRemembered(raw: string | null, now = new Date()): RememberedOrder[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const cutoff = now.getTime() - REMEMBER_DAYS * 24 * 60 * 60 * 1000;
  const seen = new Set<string>();
  const orders: RememberedOrder[] = [];

  for (const entry of parsed) {
    if (!isRememberedOrder(entry)) continue;
    if (Date.parse(entry.placedAt) < cutoff) continue;
    if (seen.has(entry.token)) continue;
    seen.add(entry.token);
    orders.push({ token: entry.token, reference: entry.reference, placedAt: entry.placedAt });
  }

  return orders
    .sort((a, b) => Date.parse(b.placedAt) - Date.parse(a.placedAt))
    .slice(0, MAX_REMEMBERED);
}

/** Adds an order to the list, newest first, without duplicating it. */
export function addRemembered(
  existing: RememberedOrder[],
  order: RememberedOrder,
  now = new Date()
): RememberedOrder[] {
  const merged = [order, ...existing.filter((entry) => entry.token !== order.token)];
  return parseRemembered(JSON.stringify(merged), now);
}

export function removeRemembered(existing: RememberedOrder[], token: string): RememberedOrder[] {
  return existing.filter((entry) => entry.token !== token);
}

// --- Browser bindings ------------------------------------------------------
//
// Every access is wrapped: storage throws outright in a Safari private window
// and when a browser is configured to block site data, and the tracking page
// must still render for someone in that situation.

export function readRemembered(now = new Date()): RememberedOrder[] {
  try {
    return parseRemembered(window.localStorage.getItem(STORAGE_KEY), now);
  } catch {
    return [];
  }
}

export function writeRemembered(orders: RememberedOrder[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
    notify();
  } catch {
    // A device that cannot remember is why the reference-and-phone lookup
    // exists. Nothing to report here.
  }
}

export function rememberOrder(order: RememberedOrder, now = new Date()): RememberedOrder[] {
  const next = addRemembered(readRemembered(now), order, now);
  writeRemembered(next);
  return next;
}

export function forgetOrder(token: string): RememberedOrder[] {
  const next = removeRemembered(readRemembered(), token);
  writeRemembered(next);
  return next;
}

// --- External store --------------------------------------------------------
//
// The list is state that lives outside React, so React subscribes to it rather
// than copying it into component state on mount. That is not ceremony: it is
// what makes the list update when a second tab places an order, and what stops
// the tracking page and the orders page from disagreeing about what the device
// remembers.
//
// `useSyncExternalStore` calls the snapshot on every render and compares by
// identity, so the snapshot must be the *same array* until something actually
// changes. Hence the cache keyed on the raw stored string.

const EMPTY: RememberedOrder[] = [];
let cachedRaw: string | null = null;
let cachedValue: RememberedOrder[] = EMPTY;

const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

export function subscribeRemembered(listener: () => void): () => void {
  listeners.add(listener);
  // Another tab writing the same key fires `storage` here but not in the tab
  // that wrote it, which is why same-tab changes notify explicitly.
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function rememberedSnapshot(): RememberedOrder[] {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return EMPTY;
  }
  if (raw === cachedRaw) return cachedValue;
  cachedRaw = raw;
  cachedValue = parseRemembered(raw);
  return cachedValue;
}

/** The server renders no remembered orders; it has no way to know of any. */
export function rememberedServerSnapshot(): RememberedOrder[] {
  return EMPTY;
}
