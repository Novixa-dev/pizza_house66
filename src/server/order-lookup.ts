import "server-only";

import { prisma } from "@/lib/db";
import { CUSTOMER_VISIBLE_LABELS, STATUS_TONE } from "@/lib/order-state";
import type { OrderStatus } from "@prisma/client";

// Finding an order again.
//
// A guest order lives behind a capability token, and the tracking link is the
// only thing that holds it. That is the right security model and the wrong
// user experience on its own: close the tab and the order is gone, and the
// restaurant answers "where is my order?" by hand.
//
// Two recoveries, and they cover different people:
//
//   1. The device remembers (src/lib/order-memory.ts). Zero friction, but
//      only on the browser that ordered, and gone if they clear site data.
//   2. Order number plus phone, here. Works from any device, and is what
//      every large pizza chain's tracker asks for, because it is two facts
//      and only one of them appears on the receipt.
//
// The reference is short and therefore guessable; the phone number is the
// secret. So this is throttled hard, and it answers identically whether the
// reference was wrong, the phone was wrong, or both — an attacker must not be
// able to use it to learn which order numbers exist.

/**
 * The comparable part of a phone number.
 *
 * `normalizePhone` in the order schema keeps the country code, which is right
 * for identity: it is what makes two customers distinct. It is wrong for
 * recall, because the same person types `0772207788` at checkout and
 * `+967 772 207 788` a day later and means the same phone. Comparing the last
 * nine digits — the length of a Yemeni mobile number — treats those as equal
 * without treating two genuinely different numbers as equal.
 */
export function phoneTail(raw: string, digits = 9): string {
  const onlyDigits = raw.replace(/\D/g, "");
  return onlyDigits.slice(-digits);
}

export interface OrderSummary {
  token: string;
  reference: string;
  status: OrderStatus;
  statusLabelAr: string;
  statusLabelEn: string;
  tone: (typeof STATUS_TONE)[OrderStatus];
  requestedPickupAt: Date;
  createdAt: Date;
  totalMinor: number;
  currency: string;
  itemCount: number;
  live: boolean;
}

const FINISHED: OrderStatus[] = ["COMPLETED", "CANCELLED", "REJECTED", "REFUNDED"];

function toSummary(order: {
  trackingToken: string;
  reference: string;
  status: OrderStatus;
  requestedPickupAt: Date;
  createdAt: Date;
  totalMinor: number;
  currency: string;
  items: { quantity: number }[];
}): OrderSummary {
  const label = CUSTOMER_VISIBLE_LABELS[order.status];
  return {
    token: order.trackingToken,
    reference: order.reference,
    status: order.status,
    statusLabelAr: label.ar,
    statusLabelEn: label.en,
    tone: STATUS_TONE[order.status],
    requestedPickupAt: order.requestedPickupAt,
    createdAt: order.createdAt,
    totalMinor: order.totalMinor,
    currency: order.currency,
    itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    live: !FINISHED.includes(order.status),
  };
}

const SUMMARY_SELECT = {
  trackingToken: true,
  reference: true,
  status: true,
  requestedPickupAt: true,
  createdAt: true,
  totalMinor: true,
  currency: true,
  items: { select: { quantity: true } },
} as const;

/**
 * The token for an order, given its reference and the phone that placed it.
 *
 * Returns null for every failure, deliberately: a caller that could tell
 * "no such order" from "wrong phone" would be an order-number oracle.
 */
export async function findOrderByReferenceAndPhone(
  reference: string,
  phone: string
): Promise<string | null> {
  const cleanReference = reference.trim().toUpperCase();
  if (cleanReference.length < 3 || cleanReference.length > 32) return null;

  const tail = phoneTail(phone);
  if (tail.length < 7) return null;

  const order = await prisma.order.findUnique({
    where: { reference: cleanReference },
    select: { trackingToken: true, guestPhone: true },
  });
  if (!order) return null;
  if (phoneTail(order.guestPhone) !== tail) return null;

  return order.trackingToken;
}

/**
 * Summaries for the tokens a device remembers.
 *
 * Takes tokens rather than a phone number on purpose: holding the token is
 * already proof of having placed the order, so this grants nothing the
 * tracking link does not. Unknown tokens are dropped rather than reported, so
 * the page cannot be used to test whether a token is valid any faster than
 * visiting it would.
 */
export async function summarizeOrders(tokens: string[]): Promise<OrderSummary[]> {
  const valid = [...new Set(tokens)]
    .filter((token) => typeof token === "string" && token.length >= 16 && token.length <= 128)
    .slice(0, 24);
  if (valid.length === 0) return [];

  const orders = await prisma.order.findMany({
    where: { trackingToken: { in: valid } },
    select: SUMMARY_SELECT,
    orderBy: { createdAt: "desc" },
  });

  return orders.map(toSummary);
}
