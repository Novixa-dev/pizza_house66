import { expect, test, type Page } from "@playwright/test";
import { E2E_NAME_PREFIX, E2E_PHONE_PREFIX } from "./global-setup";

// The journey the whole product exists for (docs/PRD.md §93):
//
//   home → menu → product → customize → cart → checkout → order → tracking
//
// These run against a real build and a real database, so a pass means the
// ordering flow genuinely works, not that a mock agreed with itself.

/** Adds the first available pizza to the cart and returns to the cart page. */
async function addPizzaToCart(page: Page) {
  await page.goto("/menu");
  await page.getByRole("link", { name: /margherita|مارغريتا/i }).first().click();
  await expect(page).toHaveURL(/\/product\//);

  // Required option groups (size, crust) come pre-selected, so the button is
  // enabled on arrival — verify that, since a disabled CTA on load is a
  // conversion bug.
  const addButton = page.getByRole("button", { name: /add to cart|أضف إلى السلة/i });
  await expect(addButton).toBeEnabled();
  await addButton.click();

  await expect(page).toHaveURL(/\/cart/);
}

test.describe("customer ordering", () => {
  test("home page shows the restaurant and routes to the menu", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // The ordering CTA must be prominent (docs/PRD.md §9.1).
    await page.getByRole("link", { name: /order now|اطلب الآن/i }).first().click();
    await expect(page).toHaveURL(/\/menu/);
  });

  test("menu lists categories and filters by search", async ({ page }) => {
    await page.goto("/menu");

    await expect(page.getByRole("heading", { name: /pizza|البيتزا/i }).first()).toBeVisible();

    await page.getByRole("searchbox").fill("pepperoni");
    await expect(page.getByRole("link", { name: /pepperoni|بيبروني/i }).first()).toBeVisible();
    // Something from another category should now be filtered out.
    await expect(page.getByRole("link", { name: /^cheesecake$|^تشيز كيك$/i })).toHaveCount(0);
  });

  test("a sold-out product is visible but not orderable", async ({ page }) => {
    await page.goto("/menu");
    // Tiramisu is seeded SOLD_OUT specifically so this state is exercised.
    const soldOut = page.locator('[aria-label*="Sold out"], [aria-label*="غير متوفر"]').first();
    await expect(soldOut).toBeVisible();
    // It is a div, not a link — there is nothing to click through to.
    await expect(soldOut).not.toHaveAttribute("href", /.*/);
  });

  test("product customization updates the running total", async ({ page }) => {
    await page.goto("/menu");
    await page.getByRole("link", { name: /margherita|مارغريتا/i }).first().click();

    const total = page.getByTestId("product-total");
    await expect(total).toBeVisible();

    // Adding a paid extra must move the displayed total — the preview the
    // customer sees has to track their choices, even though the server is
    // what finally prices the order.
    const before = await total.innerText();
    await page.getByRole("button", { name: /extra cheese|جبن إضافي/i }).first().click();
    await expect(total).not.toHaveText(before);
  });

  test("cart persists quantity changes and reaches checkout", async ({ page }) => {
    await addPizzaToCart(page);

    await page.getByRole("button", { name: /increase|زيادة/i }).first().click();
    await expect(page.getByText("2", { exact: true }).first()).toBeVisible();

    await page.getByRole("link", { name: /checkout|إتمام الطلب|متابعة/i }).first().click();
    await expect(page).toHaveURL(/\/checkout/);
  });

  test("checkout places an ASAP order and lands on tracking", async ({ page }) => {
    await addPizzaToCart(page);
    await page.getByRole("link", { name: /checkout|إتمام الطلب|متابعة/i }).first().click();

    await page.getByLabel(/name|الاسم/i).first().fill(`${E2E_NAME_PREFIX}Checkout`);
    await page.getByLabel(/phone|رقم الهاتف/i).first().fill(`${E2E_PHONE_PREFIX}01`);

    // ASAP is the default; pay-at-pickup is the first enabled method.
    await page.getByRole("button", { name: /place order|تأكيد الطلب/i }).click();

    await expect(page).toHaveURL(/\/order\//, { timeout: 20_000 });
    // The order reference is the customer's handle on their order.
    await expect(page.getByText(/PH-/)).toBeVisible();
  });

  test("scheduled pickup only offers slots the server generated", async ({ page }) => {
    await addPizzaToCart(page);
    await page.getByRole("link", { name: /checkout|إتمام الطلب|متابعة/i }).first().click();

    await page.getByRole("radio", { name: /schedule for later|تحديد وقت لاحق/i }).check();

    // Targeted by test id rather than by text: the day labels are Arabic in
    // the RTL project, where an ASCII \w pattern matches nothing.
    await expect(page.getByTestId("pickup-days").getByRole("button").first()).toBeVisible();

    const slots = page.getByTestId("pickup-slots").getByRole("button");
    await expect(slots.first()).toBeVisible();

    // Every offered time is a button the server produced — there is no free
    // text field, so an arbitrary timestamp cannot be entered at all
    // (docs/PRD.md §12.3).
    await expect(page.locator('input[type="datetime-local"]')).toHaveCount(0);

    // Picking one and placing the order must succeed end to end.
    await slots.first().click();
    await page.getByLabel(/name|الاسم/i).first().fill(`${E2E_NAME_PREFIX}Scheduled`);
    await page.getByLabel(/phone|رقم الهاتف/i).first().fill(`${E2E_PHONE_PREFIX}03`);
    await page.getByRole("button", { name: /place order|تأكيد الطلب/i }).click();
    await expect(page).toHaveURL(/\/order\//, { timeout: 20_000 });
  });

  test("the tracking page is not indexable", async ({ page, request }) => {
    await addPizzaToCart(page);
    await page.getByRole("link", { name: /checkout|إتمام الطلب|متابعة/i }).first().click();
    await page.getByLabel(/name|الاسم/i).first().fill(`${E2E_NAME_PREFIX}Robots`);
    await page.getByLabel(/phone|رقم الهاتف/i).first().fill(`${E2E_PHONE_PREFIX}02`);
    await page.getByRole("button", { name: /place order|تأكيد الطلب/i }).click();
    await expect(page).toHaveURL(/\/order\//, { timeout: 20_000 });

    // An indexed tracking URL would leak the capability token it carries.
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/
    );

    const robots = await request.get("/robots.txt");
    expect(await robots.text()).toContain("/order/");
  });
});
