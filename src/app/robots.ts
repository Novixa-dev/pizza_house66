import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Staff areas, per-visitor pages and the API surface have nothing to
      // index. `/order/` matters most: those URLs carry a capability token,
      // and an indexed one would be a leak.
      disallow: ["/admin", "/kitchen", "/api/", "/order/", "/cart", "/checkout"],
    },
    sitemap: `${appUrl()}/sitemap.xml`,
    host: appUrl(),
  };
}
