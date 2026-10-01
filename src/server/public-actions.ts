"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  buildReorder,
  findOrderByReferenceAndPhone,
  summarizeOrders,
  type OrderSummary,
  type ReorderResult,
} from "./order-lookup";
import { couponsForPhone, loyaltyStandingForPhone, type CustomerCoupon, type LoyaltyStanding } from "./coupons";
import { normalizePhone } from "./order-schema";

// Public, unauthenticated actions. Every one is throttled by client address,
// because none of them sits behind a session (docs/SECURITY.md).

function clientAddress(headerList: Headers): string {
  const forwarded = headerList.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return headerList.get("x-real-ip") ?? "unknown";
}

export interface LookupState {
  error?: "invalid" | "not_found" | "rate_limited";
}

/**
 * Order number plus phone, and you are back on your tracking page.
 *
 * Ten tries in fifteen minutes. That is generous for someone reading a
 * crumpled receipt and hopeless for someone walking the order-number space:
 * references are sequential, so an unthrottled version of this would hand out
 * every order in the restaurant to anyone who also guessed one phone number.
 */
export async function lookupOrderAction(
  _previous: LookupState,
  formData: FormData
): Promise<LookupState> {
  const headerList = await headers();
  const limit = checkRateLimit(`order-lookup:${clientAddress(headerList)}`, 10, 15 * 60_000);
  if (limit.limited) return { error: "rate_limited" };

  const reference = String(formData.get("reference") ?? "");
  const phone = String(formData.get("phone") ?? "");
  if (reference.trim().length < 3 || phone.trim().length < 7) return { error: "invalid" };

  const token = await findOrderByReferenceAndPhone(reference, phone);
  // One message for a wrong number, a wrong reference, and an order that was
  // never placed. Distinguishing them would confirm which order numbers exist.
  if (!token) return { error: "not_found" };

  redirect(`/order/${token}`);
}

/**
 * Live status for the orders a device remembers.
 *
 * The browser holds the tokens; the server holds the statuses. Passing tokens
 * back grants nothing — whoever has one can already open its tracking page.
 */
export async function summarizeRememberedAction(tokens: string[]): Promise<OrderSummary[]> {
  const headerList = await headers();
  const limit = checkRateLimit(`order-summaries:${clientAddress(headerList)}`, 60, 5 * 60_000);
  if (limit.limited) return [];
  if (!Array.isArray(tokens)) return [];
  return summarizeOrders(tokens.map(String));
}

export interface CouponLookupState {
  error?: "invalid" | "rate_limited";
  phone?: string;
  coupons?: CustomerCoupon[];
  standing?: LoyaltyStanding | null;
  searched?: boolean;
}

/**
 * The coupons issued to a phone number, and how far along its loyalty is.
 *
 * A phone number alone is enough here, unlike the order lookup, because
 * nothing this returns is private in the same way: a coupon code is worthless
 * to anyone but its owner — checkout refuses it unless the phone on the order
 * matches the phone it was issued to. What is worth protecting is the ability
 * to enumerate customers, so this is throttled to the same degree.
 */
export async function lookupCouponsAction(
  _previous: CouponLookupState,
  formData: FormData
): Promise<CouponLookupState> {
  const headerList = await headers();
  const limit = checkRateLimit(`coupon-lookup:${clientAddress(headerList)}`, 10, 15 * 60_000);
  if (limit.limited) return { error: "rate_limited" };

  const raw = String(formData.get("phone") ?? "").trim();
  if (raw.length < 7 || raw.length > 20 || !/^[+]?[\d\s()-]+$/.test(raw)) {
    return { error: "invalid" };
  }

  const phone = normalizePhone(raw);
  const [coupons, standing] = await Promise.all([
    couponsForPhone(phone),
    loyaltyStandingForPhone(phone),
  ]);
  return { phone: raw, coupons, standing, searched: true };
}

/**
 * The basket for ordering a past order again.
 *
 * Takes the tracking token, which whoever is asking already holds — so this
 * grants nothing the order's own page does not. Prices come back live, never
 * from the receipt, and anything no longer orderable is named rather than
 * quietly left out.
 */
export async function reorderAction(token: string): Promise<ReorderResult | null> {
  const headerList = await headers();
  const limit = checkRateLimit(`reorder:${clientAddress(headerList)}`, 30, 5 * 60_000);
  if (limit.limited) return null;
  return buildReorder(String(token));
}
