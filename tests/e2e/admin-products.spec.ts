import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { signInAs } from "./auth-helper";

// The product list at the restaurant's real size.
//
// It was written against 16 items. The restaurant's own listing shows roughly
// 184, and the sold-out toggle on this page is the most frequent edit during
// service — so finding one product has to be quick, and after an import the
// first question is "how many are still hidden?". These check the controls
// that answer both, and that the filters hold together: searching must not
// drop the availability filter, and the counts must add up.

// Scoped to `main` on purpose, and not only to skip the sidebar.
//
// Staff pages stream in behind a loading boundary: Next writes the finished
// page into a hidden staging <div> at the end of <body>, and a script moves it
// into place. For a few milliseconds after `load` — long enough for the first
// assertion to land in it, about one navigation in twenty — that hidden copy
// and the live one in <main> are both in the document, so an unscoped
// `a[href=…]` or `input[name=…]` matches twice and Playwright's strict mode
// throws. Nothing is wrong with the page; the locator was just too wide.
// `main …` cannot see the staging copy, and role-based locators skip hidden
// elements, so the first assertion no longer depends on that timing.

/** Every product row's edit link, excluding the "new product" button. */
const PRODUCT_LINKS = 'main a[href^="/admin/products/"]:not([href$="/new"])';

async function openProducts(page: Page, query = "") {
  await signInAs(page, "manager@pizzahouse.local");
  await page.goto(`/admin/products${query}`);
}

test.describe("admin product list", () => {
  test("search narrows the list to matching products", async ({ page }) => {
    await openProducts(page);
    const everything = await page.locator(PRODUCT_LINKS).count();
    expect(everything, "the seeded menu has more than one product").toBeGreaterThan(1);

    await page.goto("/admin/products?q=margherita");

    const matches = page.locator(PRODUCT_LINKS);
    await expect(matches.first()).toBeVisible();
    expect(await matches.count()).toBeLessThan(everything);
    // Whichever language the project renders, every row left is the product searched for.
    for (const text of await matches.allInnerTexts()) {
      expect(text).toMatch(/margherita|مارجريتا|مارغريتا/i);
    }
  });

  test("search finds a product however its Arabic was typed", async ({ page }) => {
    const prisma = new PrismaClient();
    try {
      const supreme = await prisma.product.findUniqueOrThrow({ where: { slug: "supreme" } });
      const row = page.locator(`main a[href="/admin/products/${supreme.id}"]`);

      // The name ends in ة; a phone keyboard types ه. Matching in SQL would
      // miss it, and mid-service nobody retypes a search — they scroll.
      await openProducts(page, `?q=${encodeURIComponent("الخاصه")}`);
      await expect(row).toBeVisible();
      await expect(page.locator(PRODUCT_LINKS)).toHaveCount(1);

      // Every word has to match, in any order.
      await page.goto(`/admin/products?q=${encodeURIComponent("سوبريم هاوس")}`);
      await expect(row).toBeVisible();
    } finally {
      await prisma.$disconnect();
    }
  });

  test("a search with no match says so, and offers a way back", async ({ page }) => {
    await openProducts(page, "?q=zzqqxx-no-such-product");

    await expect(page.locator(PRODUCT_LINKS)).toHaveCount(0);
    // The way back is the only link to the bare list besides the nav.
    await expect(page.locator('main a[href="/admin/products"]').first()).toBeVisible();
  });

  test("the availability counts add up to the whole menu", async ({ page }) => {
    await openProducts(page);

    // Scoped to `main`: the staff sidebar is also a nav with a link to this page.
    const chips = page.locator('main nav a[href^="/admin/products"]');
    await expect(chips).toHaveCount(4); // all, available, sold out, hidden

    const numbers = await chips.locator(".numeric").allInnerTexts();
    const [all, ...parts] = numbers.map(Number);
    expect(parts.reduce((sum, value) => sum + value, 0)).toBe(all);
  });

  test("filters by availability, and searching keeps that filter", async ({ page }) => {
    // Created here rather than assumed: nothing in the seed is sold out.
    const prisma = new PrismaClient();
    try {
      const veggie = await prisma.product.update({
        where: { slug: "veggie" },
        data: { availability: "SOLD_OUT" },
      });

      const row = page.locator(`main a[href="/admin/products/${veggie.id}"]`);

      await openProducts(page, "?status=SOLD_OUT");
      await expect(row).toBeVisible();

      // Hidden must not contain it.
      await page.goto("/admin/products?status=HIDDEN");
      await expect(page.locator("main nav a[aria-current='true']")).toHaveCount(1);
      await expect(row).toHaveCount(0);

      // Searching from inside a filter keeps the filter in the URL.
      await page.goto("/admin/products?status=SOLD_OUT");
      const search = page.getByRole("searchbox");
      await search.fill("veg");
      await search.press("Enter");
      await expect(page).toHaveURL(/status=SOLD_OUT/);
      await expect(page).toHaveURL(/q=veg/);
      // And the filtered result is still the product, not an empty page.
      await expect(row).toBeVisible();
    } finally {
      await prisma.product.update({ where: { slug: "veggie" }, data: { availability: "AVAILABLE" } });
      await prisma.$disconnect();
    }
  });

  test("the active filter is marked for assistive technology", async ({ page }) => {
    await openProducts(page, "?status=HIDDEN");
    const current = page.locator('main nav a[aria-current="true"]');
    await expect(current).toHaveCount(1);
    await expect(current).toHaveAttribute("href", /status=HIDDEN/);
  });
});
