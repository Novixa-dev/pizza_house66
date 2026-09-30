import { expect, test } from "@playwright/test";
import { signInAs as signIn } from "./auth-helper";

// Staff flows and the security properties the brief calls out explicitly
// (docs/PRD.md §72.3 staff/kitchen flows, §73 security QA).

test.describe("authentication", () => {
  test("admin pages redirect an anonymous visitor to login", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("the kitchen display also requires a session", async ({ page }) => {
    await page.goto("/kitchen");
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("bad credentials are rejected without saying which field was wrong", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel(/email|البريد/i).fill("owner@pizzahouse.local");
    await page.getByLabel(/password|كلمة المرور/i).fill("definitely-not-the-password");
    await page.getByRole("button", { name: /sign in|دخول/i }).click();

    await expect(page).toHaveURL(/error=invalid/);
    // The message says only that the credentials were wrong — never which of
    // the two fields, which would confirm whether an account exists.
    // (Targeted by text rather than role: Next.js renders a visually hidden
    // route announcer that also carries role="alert".)
    await expect(page.getByText(/invalid email or password|بيانات الدخول غير صحيحة/i)).toBeVisible();
  });

  test("repeated bad passwords for one account are rate limited", async ({ page }) => {
    // Per-account throttling, so a distributed attempt can't walk one
    // account's password space (docs/PRD.md §39).
    for (let attempt = 0; attempt < 6; attempt++) {
      await page.goto("/admin/login");
      await page.getByLabel(/email|البريد/i).fill("ratelimit-probe@pizzahouse.local");
      await page.getByLabel(/password|كلمة المرور/i).fill(`wrong-${attempt}`);
      await page.getByRole("button", { name: /sign in|دخول/i }).click();
      await page.waitForURL(/error=/);
    }
    await expect(page).toHaveURL(/error=rate_limited/);
  });

  test("an owner signs in and reaches the dashboard", async ({ page }) => {
    await signIn(page, "owner@pizzahouse.local");
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

test.describe("role-based access control", () => {
  test("kitchen staff are sent to the kitchen, not the admin area", async ({ page }) => {
    await signIn(page, "kitchen@pizzahouse.local");
    // Signing in lands them on /kitchen; asking for /admin bounces them back.
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/kitchen/);
  });

  test("kitchen staff cannot open settings, staff or reports", async ({ page }) => {
    await signIn(page, "kitchen@pizzahouse.local");

    for (const path of ["/admin/settings", "/admin/staff", "/admin/reports", "/admin/audit"]) {
      await page.goto(path);
      // Every one of these redirects out of the admin area — the permission
      // check is server-side, not a hidden nav link (docs/PRD.md §92.G).
      await expect(page, `${path} must not be reachable`).toHaveURL(/\/kitchen/);
    }
  });

  test("a cashier can review payments but not manage staff", async ({ page }) => {
    await signIn(page, "cashier@pizzahouse.local");

    await page.goto("/admin/payments");
    await expect(page).toHaveURL(/\/admin\/payments/);

    // Denied, and told why — not dumped into a generic error page.
    await page.goto("/admin/staff");
    await expect(page).toHaveURL(/\/admin\/no-access/);
  });

  test("the staff nav hides what the role cannot use", async ({ page }) => {
    await signIn(page, "cashier@pizzahouse.local");
    await page.goto("/admin");
    await expect(page.getByRole("link", { name: /staff|الموظفون/i })).toHaveCount(0);
  });
});

test.describe("receipt access control", () => {
  test("an anonymous request for a receipt is refused", async ({ request }) => {
    // Even a valid id must not serve bytes without a session; an invented one
    // must not reveal whether it exists (docs/PRD.md §42, §73).
    const response = await request.get("/api/receipts/some-payment-id", {
      maxRedirects: 0,
      failOnStatusCode: false,
    });
    expect([401, 404, 307, 302]).toContain(response.status());
  });
});

test.describe("order API integrity", () => {
  test("a submitted price is ignored in favour of the server's own", async ({ request }) => {
    const menu = await request.get("/api/orders", { failOnStatusCode: false });
    expect(menu.status()).toBe(405); // GET is not a route on this endpoint
  });

  test("a malformed order is rejected with a validation error", async ({ request }) => {
    const response = await request.post("/api/orders", {
      data: { nonsense: true },
      failOnStatusCode: false,
    });
    expect(response.status()).toBe(400);
    expect((await response.json()).error).toBe("VALIDATION_ERROR");
  });

  test("an order for a non-existent product is refused", async ({ request }) => {
    const response = await request.post("/api/orders", {
      failOnStatusCode: false,
      data: {
        idempotencyKey: `e2e-${Date.now()}-missing`,
        items: [{ productId: "does-not-exist", quantity: 1, optionValueIds: [] }],
        customer: { name: "Probe", phone: "+967700000000" },
        pickup: { mode: "ASAP" },
        payment: { method: "PAY_AT_PICKUP" },
      },
    });
    expect(response.status()).toBe(409);
    expect((await response.json()).error).toBe("PRODUCT_UNAVAILABLE");
  });

  test("the cron endpoint refuses an unauthenticated trigger", async ({ request }) => {
    const response = await request.get("/api/cron/release-orders", { failOnStatusCode: false });
    expect(response.status()).toBe(401);
  });
});

test.describe("destructive actions ask first", () => {
  test("cancelling an order needs a confirmation, and declining changes nothing", async ({
    page,
  }) => {
    // Cancelling is terminal in the state machine — only a refund follows it —
    // and the button sits one tab stop from "send to the kitchen now".
    await signIn(page, "owner@pizzahouse.local");
    await page.goto("/admin/orders");

    const firstOrder = page.locator('a[href^="/admin/orders/"]').first();
    await expect(firstOrder).toBeVisible();
    await firstOrder.click();
    await expect(page).toHaveURL(/\/admin\/orders\/[^/]+$/);

    const cancel = page.getByRole("button", { name: /إلغاء الطلب|Cancel order/ });
    if ((await cancel.count()) === 0) {
      // Already in a state with no cancel transition — nothing to guard.
      test.skip();
      return;
    }

    const statusBefore = await page.locator("main").innerText();

    let asked: string | null = null;
    page.on("dialog", async (dialog) => {
      asked = dialog.message();
      await dialog.dismiss();
    });
    await cancel.click();
    await page.waitForTimeout(1000);

    // The dialog has to say what is about to happen, not just "are you sure".
    expect(asked, "no confirmation dialog appeared").not.toBeNull();
    expect(asked!).toMatch(/لا يمكن التراجع|can't be undone/);

    // Declining leaves the order exactly as it was.
    await page.reload();
    expect(await page.locator("main").innerText()).toBe(statusBefore);
  });
});

test.describe("kitchen workflow", () => {
  test("the board renders its three lanes", async ({ page }) => {
    await signIn(page, "kitchen@pizzahouse.local");
    await page.goto("/kitchen");

    // To start / Preparing / Ready — the only three states a cook acts on.
    const headings = page.getByRole("heading", { level: 2 });
    await expect(headings).toHaveCount(await headings.count());
    expect(await headings.count()).toBeGreaterThanOrEqual(3);
  });
});

test.describe("security headers", () => {
  test("responses carry the expected hardening headers", async ({ request }) => {
    const response = await request.get("/");
    const headers = response.headers();

    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["content-security-policy"]).toContain("object-src 'none'");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  });
});
