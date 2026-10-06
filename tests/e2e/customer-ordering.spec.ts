import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { E2E_NAME_PREFIX, E2E_PHONE_PREFIX } from "./global-setup";

/**
 * Opens the margherita product page.
 *
 * By slug, not by display name. Matching the rendered name coupled every one
 * of these tests to one transliteration of "Margherita": the catalogue was
 * updated to the restaurant's own Arabic spelling — مارجريتا with a ج, not a
 * غ — and five tests failed on a menu edit that broke nothing. A slug is the
 * stable identifier, and it is the same in both languages.
 */
async function openMargherita(page: Page) {
  await page.goto("/menu");
  await page.locator('a[href="/product/margherita"]').first().click();
  await expect(page).toHaveURL(/\/product\/margherita/);
}
// The journey the whole product exists for (docs/PRD.md §93):
//
//   home → menu → product → customize → cart → checkout → order → tracking
//
// These run against a real build and a real database, so a pass means the
// ordering flow genuinely works, not that a mock agreed with itself.

/** Adds the first available pizza to the cart and returns to the cart page. */
async function addPizzaToCart(page: Page) {
  await openMargherita(page);

  // Required option groups (size, crust) come pre-selected, so the button is
  // enabled on arrival — verify that, since a disabled CTA on load is a
  // conversion bug.
  const addButton = page.getByRole("button", {
    name: /add to cart|أضف إلى السلة/i,
  });
  await expect(addButton).toBeEnabled();
  await addButton.click();

  await expect(page).toHaveURL(/\/cart/);
}

test.describe("customer ordering", () => {
  test("home page shows the restaurant and routes to the menu", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // The ordering CTA must be prominent (docs/PRD.md §9.1).
    await page
      .getByRole("link", { name: /order now|اطلب الآن/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/menu/);
  });

  test("menu lists categories and filters by search", async ({ page }) => {
    await page.goto("/menu");

    await expect(
      page.getByRole("heading", { name: /pizza|البيتزا/i }).first(),
    ).toBeVisible();

    await page.getByRole("searchbox").fill("pepperoni");
    // Asserted by slug rather than by the rendered name. The Arabic for
    // "pepperoni" can be spelled ببروني or بيبروني, and the catalogue uses
    // the restaurant's own spelling — matching the name made this test an
    // assertion about transliteration rather than about search.
    await expect(page.locator('a[href="/product/pepperoni"]')).toHaveCount(1);
    // Something from another category should now be filtered out.
    await expect(page.locator('a[href="/product/pepsi"]')).toHaveCount(0);
  });

  test("a sold-out product is visible but not orderable", async ({ page }) => {
    // The condition is created here rather than seeded. It used to rely on
    // one product being permanently SOLD_OUT in the seed, which silently
    // stopped covering anything the moment that product left the catalogue —
    // the test kept passing against a menu where nothing was sold out,
    // because it only looked for the first match of a selector.
    const prisma = new PrismaClient();
    try {
      await prisma.product.update({
        where: { slug: "veggie" },
        data: { availability: "SOLD_OUT" },
      });

      await page.goto("/menu");

      // The menu renders a product in more than one place — a featured rail
      // and its category section — so every card for it is checked rather
      // than the first. A sold-out item that still reads as orderable in one
      // of them is the whole failure this guards against.
      const cards = page.locator('[data-testid="product-card-veggie"]');
      const count = await cards.count();
      expect(count, "veggie should be on the menu").toBeGreaterThan(0);

      for (let i = 0; i < count; i += 1) {
        const card = cards.nth(i);
        await expect(card).toBeVisible();
        await expect(card.getByText(/sold out|غير متوفر/i).first()).toBeVisible();
        // Still listed, so a customer can see the item exists — but the card
        // is a div, not a link: there is nothing to click through to
        // (docs/PRD.md §17).
        await expect(card).not.toHaveAttribute("href", /.*/);
      }
      await expect(page.locator('a[href="/product/veggie"]')).toHaveCount(0);
    } finally {
      await prisma.product.update({
        where: { slug: "veggie" },
        data: { availability: "AVAILABLE" },
      });
      await prisma.$disconnect();
    }
  });

  test("product customization updates the running total", async ({ page }) => {
    await openMargherita(page);

    const total = page.getByTestId("product-total");
    await expect(total).toBeVisible();

    // Adding a paid extra must move the displayed total — the preview the
    // customer sees has to track their choices, even though the server is
    // what finally prices the order.
    const before = await total.innerText();
    await page
      .getByRole("button", { name: /extra cheese|جبن إضافي/i })
      .first()
      .click();
    await expect(total).not.toHaveText(before);
  });

  test("cart persists quantity changes and reaches checkout", async ({
    page,
  }) => {
    await addPizzaToCart(page);

    await page
      .getByRole("button", { name: /increase|زيادة/i })
      .first()
      .click();
    await expect(page.getByText("2", { exact: true }).first()).toBeVisible();

    await page
      .getByRole("link", { name: /checkout|إتمام الطلب|متابعة/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/checkout/);
  });

  test("checkout places an ASAP order and lands on tracking", async ({
    page,
  }) => {
    await addPizzaToCart(page);
    await page
      .getByRole("link", { name: /checkout|إتمام الطلب|متابعة/i })
      .first()
      .click();

    await page
      .getByLabel(/name|الاسم/i)
      .first()
      .fill(`${E2E_NAME_PREFIX}Checkout`);
    await page
      .getByLabel(/phone|رقم الهاتف/i)
      .first()
      .fill(`${E2E_PHONE_PREFIX}01`);

    // ASAP is the default; pay-at-pickup is the first enabled method.
    await page
      .getByRole("button", { name: /place order|تأكيد الطلب/i })
      .click();

    await expect(page).toHaveURL(/\/order\//, { timeout: 20_000 });
    // The order reference is the customer's handle on their order.
    await expect(page.getByText(/PH-/)).toBeVisible();
  });

  test("scheduled pickup only offers slots the server generated", async ({
    page,
  }) => {
    await addPizzaToCart(page);
    await page
      .getByRole("link", { name: /checkout|إتمام الطلب|متابعة/i })
      .first()
      .click();

    await page
      .getByRole("radio", { name: /schedule for later|تحديد وقت لاحق/i })
      .check();

    // Targeted by test id rather than by text: the day labels are Arabic in
    // the RTL project, where an ASCII \w pattern matches nothing.
    await expect(
      page.getByTestId("pickup-days").getByRole("button").first(),
    ).toBeVisible();

    const slots = page.getByTestId("pickup-slots").getByRole("button");
    await expect(slots.first()).toBeVisible();

    // Wait for webfonts before clicking a slot. `next/font` swaps the Arabic
    // face in after first paint, which reflows the slot grid — Playwright
    // then refuses the click because the target is still moving, and the
    // failure reads as a timeout on a button that is plainly there. Waiting
    // for the real settle beats widening the timeout and hoping.
    await page.evaluate(() => document.fonts.ready);

    // Every offered time is a button the server produced — there is no free
    // text field, so an arbitrary timestamp cannot be entered at all
    // (docs/PRD.md §12.3).
    await expect(page.locator('input[type="datetime-local"]')).toHaveCount(0);

    // Picking one and placing the order must succeed end to end.
    await slots.first().click();
    await page
      .getByLabel(/name|الاسم/i)
      .first()
      .fill(`${E2E_NAME_PREFIX}Scheduled`);
    await page
      .getByLabel(/phone|رقم الهاتف/i)
      .first()
      .fill(`${E2E_PHONE_PREFIX}03`);
    await page
      .getByRole("button", { name: /place order|تأكيد الطلب/i })
      .click();
    await expect(page).toHaveURL(/\/order\//, { timeout: 20_000 });
  });

  test("the ASAP option tells the truth about when the food is ready", async ({
    page,
  }) => {
    // "As soon as possible" used to promise a wait of roughly the preparation
    // time whatever the clock said. While the restaurant is shut the real
    // earliest pickup is whenever it next opens — hours away — so the card was
    // making a promise the server would not keep.
    //
    // The assertion is tied to the header's own open/closed badge rather than
    // to a fixed hour, so it holds whenever the suite happens to run.
    await addPizzaToCart(page);
    await page
      .getByRole("link", { name: /checkout|إتمام الطلب|متابعة/i })
      .first()
      .click();

    const header = (await page.locator("header").first().innerText()).trim();
    const closed = /مغلق الآن|Closed now/.test(header);

    const asapCard = page
      .locator('input[name="pickup-mode"]')
      .first()
      .locator("xpath=ancestor::label[1]");
    const asapText = (await asapCard.innerText()).replace(/\s+/g, " ");

    if (closed) {
      expect(asapText).toMatch(/مغلق الآن|Closed right now/);
      expect(asapText).toMatch(/\d{1,2}:\d{2}/);
    } else {
      expect(asapText).toMatch(/~\s*\d+/);
    }
  });

  test("the tracking page is not indexable", async ({ page, request }) => {
    await addPizzaToCart(page);
    await page
      .getByRole("link", { name: /checkout|إتمام الطلب|متابعة/i })
      .first()
      .click();
    await page
      .getByLabel(/name|الاسم/i)
      .first()
      .fill(`${E2E_NAME_PREFIX}Robots`);
    await page
      .getByLabel(/phone|رقم الهاتف/i)
      .first()
      .fill(`${E2E_PHONE_PREFIX}02`);
    await page
      .getByRole("button", { name: /place order|تأكيد الطلب/i })
      .click();
    await expect(page).toHaveURL(/\/order\//, { timeout: 20_000 });

    // An indexed tracking URL would leak the capability token it carries.
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/,
    );

    const robots = await request.get("/robots.txt");
    expect(await robots.text()).toContain("/order/");
  });
});

// The phone-only bottom bar. Worth its own test because its whole value is
// conditional — it has to appear when there is something to carry and get out
// of the way when the page it points at is the page you are on — and because
// a fixed element is the easiest way to cover a page's last control by
// accident.
test.describe("the phone order bar", () => {
  test("carries the basket forward, and stays out of the way of the cart", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "mobile-ar",
      "the bar is phone-width only by design"
    );

    const bar = page.getByTestId("sticky-order-bar");

    await page.goto("/menu");
    await expect(bar).toBeHidden(); // an empty basket has nothing to carry

    await addPizzaToCart(page); // which lands on /cart
    await expect(bar).toBeHidden(); // where the bar would only repeat itself

    await page.goto("/menu");
    await expect(bar).toBeVisible();
    await expect(bar).toContainText("1");

    // The tap target, not just the bar: docs/DESIGN-SYSTEM.md commits to 44px
    // on the primary path, and this is now the shortest route to checkout.
    const target = bar.getByRole("link");
    const box = await target.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);

    // It must not be the thing that makes a phone page scroll sideways.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);

    await target.click();
    await expect(page).toHaveURL(/\/cart/);
  });
});
