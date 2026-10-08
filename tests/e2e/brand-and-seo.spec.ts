import { expect, test, type APIResponse } from "@playwright/test";

// What a link preview, a search engine and a home-screen install actually
// receive. None of this is visible when the site is used, so none of it is
// noticed until someone shares a link and it looks wrong.

/** Width and height from a PNG's header, without decoding it. */
async function pngSize(response: APIResponse): Promise<{ width: number; height: number }> {
  const bytes = await response.body();
  expect(bytes.subarray(1, 4).toString("ascii"), "is a PNG").toBe("PNG");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

test.describe("social cards and icons", () => {
  test("the site card is a 1200×630 PNG, and Twitter gets the same", async ({ request }) => {
    for (const path of ["/opengraph-image", "/twitter-image"]) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(200);
      expect(response.headers()["content-type"]).toContain("image/png");
      expect(await pngSize(response)).toEqual({ width: 1200, height: 630 });
    }
  });

  test("a product link carries that product's own card", async ({ page, request }) => {
    await page.goto("/product/supreme");
    const og = await page.locator('meta[property="og:image"]').first().getAttribute("content");
    expect(og, "the card is generated for this product, not the raw photograph").toMatch(
      /\/product\/supreme\/opengraph-image/,
    );

    const response = await request.get(new URL(og!).pathname);
    expect(response.status()).toBe(200);
    expect(await pngSize(response)).toEqual({ width: 1200, height: 630 });
    expect(await page.locator('meta[property="og:image:width"]').getAttribute("content")).toBe("1200");
  });

  test("a hidden or unknown product gets a card, never an error or a hint", async ({ page, request }) => {
    // The card route for a slug that does not exist must answer like the site
    // card — a 200 PNG — so a probe cannot tell hidden from absent.
    await page.goto("/product/supreme");
    const og = await page.locator('meta[property="og:image"]').first().getAttribute("content");
    const unknown = new URL(og!).pathname.replace("/supreme/", "/no-such-dish/");
    const response = await request.get(unknown);
    expect(response.status()).toBe(200);
    expect(await pngSize(response)).toEqual({ width: 1200, height: 630 });
  });

  test("pages without a card of their own share the site card", async ({ page }) => {
    // Every page built from `buildMetadata` once lost the root card, because a
    // page that sets its own openGraph replaces its parent's: these were shared
    // as a title and nothing else.
    for (const path of ["/", "/about", "/contact", "/menu", "/faq", "/offers", "/terms", "/privacy", "/credits"]) {
      await page.goto(path);
      const og = await page.locator('meta[property="og:image"]').first().getAttribute("content");
      expect(og, path).toMatch(/\/opengraph-image/);
      const twitter = await page.locator('meta[name="twitter:image"]').first().getAttribute("content");
      expect(twitter, `${path} twitter:image`).toMatch(/\/twitter-image/);
    }
  });

  test("the tab icon and the iOS home-screen icon are real PNGs", async ({ page, request }) => {
    await page.goto("/");
    const icon = page.locator('link[rel="icon"]').first();
    const apple = page.locator('link[rel="apple-touch-icon"]').first();

    const iconResponse = await request.get((await icon.getAttribute("href"))!);
    expect(iconResponse.headers()["content-type"]).toContain("image/png");

    const appleResponse = await request.get((await apple.getAttribute("href"))!);
    expect(appleResponse.status()).toBe(200);
    expect(await pngSize(appleResponse)).toEqual({ width: 180, height: 180 });

    // The old default path must not 404 (browsers ask for it regardless).
    const legacy = await request.get("/favicon.ico", { maxRedirects: 0 });
    expect([301, 302, 307, 308]).toContain(legacy.status());
  });

  test("the web app manifest lists installable PNG icons that resolve", async ({ request }) => {
    const manifest = await (await request.get("/manifest.webmanifest")).json();
    const sizes = (manifest.icons as { src: string; sizes: string; type: string; purpose?: string }[]).filter(
      (icon) => icon.type === "image/png",
    );
    expect(sizes.map((icon) => icon.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    expect(sizes.some((icon) => icon.purpose === "maskable")).toBe(true);

    for (const icon of sizes) {
      const response = await request.get(icon.src);
      expect(response.status(), icon.src).toBe(200);
      const [w] = icon.sizes.split("x").map(Number);
      expect(await pngSize(response)).toEqual({ width: w, height: w });
    }
  });
});

test.describe("search-engine surface", () => {
  test("the sitemap lists every public page and none of the private ones", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    for (const path of ["/menu", "/offers", "/contact", "/about", "/faq", "/terms", "/privacy", "/credits"]) {
      expect(xml, path).toContain(`${path}</loc>`);
    }
    for (const path of ["/cart", "/checkout", "/orders", "/admin", "/kitchen", "/order/"]) {
      expect(xml, path).not.toContain(`${path}`);
    }
    expect(xml).toContain("/product/");
  });

  test("the home page carries a keyword set, a category and a share card", async ({ page }) => {
    await page.goto("/");
    expect(await page.locator('meta[name="keywords"]').getAttribute("content")).toContain("فوه");
    expect(await page.locator('meta[name="category"]').getAttribute("content")).toBe("food");
    expect(await page.locator('meta[property="og:image"]').first().getAttribute("content")).toMatch(/opengraph-image/);
  });
});
