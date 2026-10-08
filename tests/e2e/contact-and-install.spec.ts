import { expect, test } from "@playwright/test";

// Getting to the restaurant, and putting it on a home screen.

test.describe("finding the restaurant", () => {
  test("directions go to the pin itself, and the Plus Code agrees with it", async ({ page }) => {
    await page.goto("/contact");

    const directions = page.locator('a[href*="maps/dir/"]').first();
    await expect(directions).toBeVisible();
    // The owner's own pin, not a text search for a name another restaurant shares.
    await expect(directions).toHaveAttribute("href", /destination=14\.4891696,49\.0444845/);

    // Computed from those coordinates, so it cannot drift from the map.
    await expect(page.getByTestId("plus-code")).toHaveText("F2QV+MQ");
  });

  test("copying the code puts it on the clipboard and says so", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/contact");

    // The second button of the Plus Code row: the first control after the code itself.
    const copyCode = page.getByTestId("plus-code").locator("xpath=../..").getByRole("button");
    await copyCode.click();

    await expect(copyCode).toContainText(/copied|تم النسخ/i);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("F2QV+MQ");
  });

  test("sharing is offered, and works without a share sheet", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/contact");
    const share = page.getByRole("button", { name: /share location|مشاركة الموقع/i });
    await expect(share).toBeVisible();

    // Headless Chromium on desktop has no share sheet; the button must fall
    // back to copying the address and link rather than doing nothing.
    await page.evaluate(() => {
      Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    });
    await share.click();
    await expect(page.locator('[role="status"]').filter({ hasText: /copied|تم النسخ/i })).toHaveCount(1);
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toContain("maps");
  });
});

test.describe("installing the app", () => {
  test("is not offered in a browser that cannot install it", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("install-prompt")).toHaveCount(0);
  });

  test("appears when the browser says the site is installable, and raises its dialog", async ({ page }) => {
    await page.goto("/");

    // Chromium fires `beforeinstallprompt` itself only for an HTTPS site that
    // meets the install criteria; here the event is raised by hand, which is
    // what the component actually listens for.
    await expect(async () => {
      await page.evaluate(() => {
        const event = new Event("beforeinstallprompt", { cancelable: true });
        Object.assign(event, {
          prompt: async () => {
            (window as unknown as { __prompted: boolean }).__prompted = true;
          },
          userChoice: Promise.resolve({ outcome: "accepted" }),
        });
        window.dispatchEvent(event);
      });
      await expect(page.getByTestId("install-prompt")).toBeVisible({ timeout: 500 });
    }).toPass({ timeout: 8000 });

    await page.getByTestId("install-prompt").getByRole("button").click();
    expect(await page.evaluate(() => (window as unknown as { __prompted?: boolean }).__prompted)).toBe(true);
    // Accepted: the button is replaced by a confirmation, not left to be tapped twice.
    await expect(page.getByTestId("install-prompt")).toHaveCount(0);
    await expect(page.locator("footer").getByText(/app installed|ثُبِّت التطبيق/i)).toBeVisible();
  });
});

test.describe("installing on an iPhone", () => {
  test.use({
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
  });

  test("shows the two taps that do it, since Safari cannot be prompted", async ({ page }) => {
    await page.goto("/");
    const prompt = page.getByTestId("install-prompt");
    await expect(prompt).toBeVisible();
    await expect(prompt.getByRole("note")).toHaveCount(0);
    await prompt.getByRole("button").click();
    await expect(prompt.getByRole("note")).toContainText(/Add to Home Screen|إضافة إلى الشاشة الرئيسية/);
  });
});

test.describe("installing from another iPhone browser", () => {
  test.use({
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/123.0 Mobile/15E148 Safari/604.1",
  });

  test("says nothing, because only Safari's share sheet has the option", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("install-prompt")).toHaveCount(0);
  });
});
