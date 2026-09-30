"use client";

import { useEffect } from "react";
import { rememberOrder } from "@/lib/order-memory";

/**
 * Writes an order into the device's list the first time its tracking page is
 * opened, so the customer can find it again after closing the tab.
 *
 * On the page rather than at checkout on purpose: this way a link forwarded to
 * a family member is remembered on *their* phone too, which is exactly who
 * ends up collecting the order.
 */
export function RememberOrder({
  token,
  reference,
  placedAt,
}: {
  token: string;
  reference: string;
  placedAt: string;
}) {
  useEffect(() => {
    rememberOrder({ token, reference, placedAt });
  }, [token, reference, placedAt]);

  return null;
}
