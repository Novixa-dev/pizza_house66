import { expect, test } from "@playwright/test";

// What a visitor is told about who and where the restaurant is.
//
// The restaurant has said publicly that this is its first and only branch and
// that it has no connection to anything else using the name; a different
// business called "Pizza House" exists with its own phone number and menu. A
// customer who searches the name can land on the wrong one, so the notice sits
// where people go to find a phone number or an address.

const ONLY_BRANCH = /فرعنا الأول والوحيد|first and only branch/i;

test.describe("who and where", () => {
  for (const path of ["/contact", "/about"]) {
    test(`${path} says this is the only branch`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByText(ONLY_BRANCH).first()).toBeVisible();
    });
  }

  test("the contact page says it takes orders and reservations", async ({ page }) => {
    await page.goto("/contact");
    await expect(page.getByText(/للطلبات والحجوزات|orders and reservations/i)).toBeVisible();
  });

  test("the structured data carries the restaurant's real coordinates", async ({ page }) => {
    await page.goto("/");

    const blocks = await page
      .locator('script[type="application/ld+json"]')
      .evaluateAll((nodes) => nodes.map((node) => node.textContent ?? ""));

    // Structured data is where Google reads the location from; without `geo`
    // the Restaurant entity has an address string and nothing it can pin.
    type Entity = { geo?: { latitude?: number; longitude?: number } };
    const entities = blocks.flatMap((raw) => {
      try {
        // The page emits one block holding an `@graph` of entities, so the
        // location is a level down from the script's top-level object.
        const parsed = JSON.parse(raw) as Entity & { "@graph"?: Entity[] };
        return parsed["@graph"] ?? [parsed];
      } catch {
        return [];
      }
    });
    const geo = entities.find((entity) => entity.geo)?.geo;

    expect(geo, "a Restaurant block with geo coordinates").toBeDefined();
    expect(geo!.latitude).toBeCloseTo(14.4891696, 4);
    expect(geo!.longitude).toBeCloseTo(49.0444845, 4);
  });
});
