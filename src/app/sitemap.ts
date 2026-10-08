import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { appUrl } from "@/lib/site";

// Public sitemap (docs/PRD.md §51).
//
// Only pages a search engine should actually index: the home page, the menu,
// and every visible product. Cart, checkout and order-tracking URLs are
// per-visitor and are excluded both here and by their own robots metadata.

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = appUrl();

  let products: { slug: string; updatedAt: Date }[] = [];
  try {
    products = await prisma.product.findMany({
      where: { availability: { not: "HIDDEN" } },
      select: { slug: true, updatedAt: true },
      orderBy: { sortOrder: "asc" },
    });
  } catch (error) {
    // A sitemap that 500s is worse than a sitemap listing only static routes:
    // the build must not fail because the database is briefly unreachable.
    console.error("[sitemap] could not load products", error);
  }

  // The pages a search engine can usefully index. `/orders` is per-visitor
  // (it lists what this browser has ordered) and /cart, /checkout and
  // /order/* are excluded by robots.txt, so none of them belong here.
  const pages: { path: string; changeFrequency: "daily" | "weekly" | "monthly" | "yearly"; priority: number }[] = [
    { path: "/offers", changeFrequency: "weekly", priority: 0.8 },
    { path: "/contact", changeFrequency: "monthly", priority: 0.8 },
    { path: "/about", changeFrequency: "monthly", priority: 0.6 },
    { path: "/faq", changeFrequency: "monthly", priority: 0.6 },
    { path: "/credits", changeFrequency: "yearly", priority: 0.2 },
    { path: "/terms", changeFrequency: "yearly", priority: 0.2 },
    { path: "/privacy", changeFrequency: "yearly", priority: 0.2 },
  ];

  return [
    { url: base, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${base}/menu`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    ...pages.map((page) => ({
      url: `${base}${page.path}`,
      lastModified: new Date(),
      changeFrequency: page.changeFrequency,
      priority: page.priority,
    })),
    ...products.map((product) => ({
      url: `${base}/product/${product.slug}`,
      lastModified: product.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
