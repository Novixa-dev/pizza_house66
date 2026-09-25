"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

// Fires the funnel events that can only be observed in the browser.
//
// Everything downstream of "order created" is recorded server-side where it
// can't be lost or faked; these two exist because a page view and a cart
// addition have no server-side moment to hook into. Both are fire-and-forget
// with `keepalive`, so a customer navigating away never waits on analytics.

export function trackClient(
  name: string,
  payload: { productId?: string; valueMinor?: number; metadata?: Record<string, unknown> } = {}
): void {
  try {
    const body = JSON.stringify({ name, ...payload });
    if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
      navigator.sendBeacon("/api/analytics", new Blob([body], { type: "application/json" }));
      return;
    }
    void fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });
  } catch {
    // Analytics is never allowed to surface an error to a customer.
  }
}

export function PageViewTracker() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    trackClient("page_view", { metadata: { path: pathname } });
    if (pathname === "/menu") trackClient("menu_view");
  }, [pathname]);

  return null;
}
