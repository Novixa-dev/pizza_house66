import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "./auth-helper";

// Automated accessibility checks (docs/PRD.md §50).
//
// `docs/DESIGN-SYSTEM.md` commits to specific things — AA contrast in both
// schemes, a visible focus ring, labelled fields, correct `dir`/`lang`. Those
// were built in and checked by hand, but nothing stopped a later change from
// quietly breaking one. These tests are what make the commitment hold.
//
// Scope: WCAG 2.1 A and AA. Violations fail the test with the rule id and the
// offending selector, so a failure says what to fix rather than that
// "accessibility broke".
//
// The whole page is scanned, including the header and footer, because a
// contrast or landmark problem in shared chrome affects every screen.

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function scan(page: Page) {
  return new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
}

/** Formats violations so a failure names the rule and the element. */
function describe(results: Awaited<ReturnType<typeof scan>>): string {
  return results.violations
    .map((violation) => {
      const targets = violation.nodes
        .slice(0, 3)
        .map((node) => node.target.join(" "))
        .join("\n      ");
      return `  [${violation.impact}] ${violation.id}: ${violation.help}\n      ${targets}`;
    })
    .join("\n");
}

async function expectNoViolations(page: Page) {
  const results = await scan(page);
  expect(results.violations, `\n${describe(results)}\n`).toEqual([]);
}

test.describe("accessibility — customer site", () => {
  for (const [path, label] of [
    ["/", "home"],
    ["/menu", "menu"],
    ["/product/margherita", "product"],
    ["/cart", "cart"],
  ] as const) {
    test(`${label} page has no WCAG A/AA violations`, async ({ page }) => {
      await page.goto(path);
      // Let client components hydrate — an unhydrated control can be missing
      // the aria attributes its hydrated form carries, which would report a
      // violation that does not exist for a real visitor.
      await page.waitForLoadState("networkidle");
      await expectNoViolations(page);
    });
  }

  test("checkout page has no WCAG A/AA violations", async ({ page }) => {
    // Scanned with a populated cart: an empty cart renders an empty state,
    // so scanning it would pass without ever looking at the form — the one
    // screen on the customer path with the most inputs to get wrong.
    await page.goto("/menu");
    await page.getByRole("link", { name: /margherita|مارغريتا/i }).first().click();
    await page.getByRole("button", { name: /add to cart|أضف إلى السلة/i }).click();
    await expect(page).toHaveURL(/\/cart/);

    await page.goto("/checkout");
    await page.waitForLoadState("networkidle");
    await expectNoViolations(page);
  });
});

test.describe("accessibility — staff screens", () => {
  test("the admin dashboard has no WCAG A/AA violations", async ({ page }) => {
    await signInAs(page, "owner@pizzahouse.local");
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");
    await expectNoViolations(page);
  });

  test("the kitchen display has no WCAG A/AA violations", async ({ page }) => {
    await signInAs(page, "kitchen@pizzahouse.local");
    await page.goto("/kitchen");
    await page.waitForLoadState("networkidle");
    await expectNoViolations(page);
  });
});

// docs/DESIGN-SYSTEM.md claims AA contrast "in both schemes". Dark mode is a
// full re-declaration of the same tokens, not a filter, so it can fail
// independently — and a claim nothing checks is a claim that drifts. Light
// mode is covered above; this covers the other half.
test.describe("accessibility — dark mode", () => {
  test.use({ colorScheme: "dark" });

  for (const [path, label] of [
    ["/", "home"],
    ["/menu", "menu"],
    ["/product/margherita", "product"],
  ] as const) {
    test(`${label} page has no WCAG A/AA violations in dark mode`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expectNoViolations(page);
    });
  }

  test("the admin dashboard has no WCAG A/AA violations in dark mode", async ({ page }) => {
    await signInAs(page, "owner@pizzahouse.local");
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");
    await expectNoViolations(page);
  });
});

// Horizontal overflow at phone width.
//
// Checkout was 555px of content in a 414px viewport: a grid child hit the
// CSS `min-width: auto` trap and refused to shrink, so the page scrolled
// sideways and the pickup-slot buttons sat partly off-screen — on the one
// screen where picking the wrong time is the worst thing that can happen.
// `docs/DESIGN-SYSTEM.md` requires phone-width layouts with no horizontal
// page scroll; this is what holds it to that.
test.describe("layout — no horizontal overflow at phone width", () => {
  test.use({ viewport: { width: 414, height: 900 } });

  async function expectNoHorizontalOverflow(page: Page, label: string) {
    await page.evaluate(() => document.fonts.ready);
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(
      scrollWidth,
      `${label}: ${scrollWidth}px of content in a ${clientWidth}px viewport`
    ).toBeLessThanOrEqual(clientWidth + 1);
  }

  for (const [path, label] of [
    ["/", "home"],
    ["/menu", "menu"],
    ["/product/margherita", "product"],
  ] as const) {
    test(`${label} page does not scroll sideways`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expectNoHorizontalOverflow(page, label);
    });
  }

  test("cart and checkout do not scroll sideways with items in the basket", async ({ page }) => {
    await page.goto("/menu");
    await page.getByRole("link", { name: /margherita|مارغريتا/i }).first().click();
    await page.getByRole("button", { name: /add to cart|أضف إلى السلة/i }).click();
    await expect(page).toHaveURL(/\/cart/);
    await page.waitForLoadState("networkidle");
    await expectNoHorizontalOverflow(page, "cart");

    await page.goto("/checkout");
    await page.waitForLoadState("networkidle");
    await expectNoHorizontalOverflow(page, "checkout");

    // The slot grid is the part that actually broke, and it only renders
    // once "schedule for later" is chosen.
    await page.getByRole("radio", { name: /schedule for later|تحديد وقت لاحق/i }).check();
    await expect(page.getByTestId("pickup-slots").getByRole("button").first()).toBeVisible();
    await expectNoHorizontalOverflow(page, "checkout with the slot picker open");
  });

  for (const [path, label, email] of [
    ["/admin", "admin dashboard", "owner@pizzahouse.local"],
    ["/admin/orders", "admin orders", "owner@pizzahouse.local"],
    ["/kitchen", "kitchen display", "kitchen@pizzahouse.local"],
  ] as const) {
    test(`${label} does not scroll sideways`, async ({ page }) => {
      await signInAs(page, email);
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expectNoHorizontalOverflow(page, label);
    });
  }
});

test.describe("accessibility — the commitments in docs/DESIGN-SYSTEM.md", () => {
  test("the document declares its language and direction", async ({ page }) => {
    await page.goto("/");
    const html = page.locator("html");
    const lang = await html.getAttribute("lang");
    const dir = await html.getAttribute("dir");

    expect(lang, "html[lang] must be set for screen readers").toBeTruthy();
    expect(["ar", "en"]).toContain(lang);
    // Arabic is RTL; English is LTR. Getting this wrong is invisible to a
    // sighted English reader and breaks the page for everyone else.
    expect(dir).toBe(lang === "ar" ? "rtl" : "ltr");
  });

  test("every checkout field is programmatically labelled", async ({ page }) => {
    // Checkout renders an empty state rather than a form when the cart is
    // empty — correct behaviour, and it means the form only exists to be
    // scanned once something is in the cart.
    await page.goto("/menu");
    await page.getByRole("link", { name: /margherita|مارغريتا/i }).first().click();
    await page.getByRole("button", { name: /add to cart|أضف إلى السلة/i }).click();
    await expect(page).toHaveURL(/\/cart/);

    await page.goto("/checkout");
    await page.waitForLoadState("networkidle");

    const fields = page.locator(
      "input:not([type=hidden]):not([type=radio]):not([type=checkbox]), select, textarea"
    );
    const count = await fields.count();
    expect(count, "checkout should render form fields").toBeGreaterThan(0);

    for (let i = 0; i < count; i += 1) {
      const field = fields.nth(i);
      const [id, ariaLabel, ariaLabelledBy] = await Promise.all([
        field.getAttribute("id"),
        field.getAttribute("aria-label"),
        field.getAttribute("aria-labelledby"),
      ]);
      const hasLabelElement = id
        ? (await page.locator(`label[for="${id}"]`).count()) > 0
        : false;
      expect(
        hasLabelElement || Boolean(ariaLabel) || Boolean(ariaLabelledBy),
        `field #${i} (id=${id ?? "none"}) has no label, aria-label or aria-labelledby`
      ).toBe(true);
    }
  });

  test("the focus indicator stays visible on a brand-coloured surface", async ({ page }) => {
    // The skip link is the first Tab stop on every page and sits on
    // `bg-brand`. A single-colour ring in the brand colour measured exactly
    // 1.00:1 there — invisible, on the one control that exists purely for
    // keyboard users. The halo is what fixes it, so its absence is the
    // regression worth catching.
    await page.goto("/");
    await page.keyboard.press("Tab");

    const focus = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return null;
      const cs = getComputedStyle(el);
      return {
        isSkipLink: el.getAttribute("href") === "#main",
        outlineWidth: parseFloat(cs.outlineWidth),
        outlineStyle: cs.outlineStyle,
        boxShadow: cs.boxShadow,
      };
    });

    expect(focus, "Tab should focus something").not.toBeNull();
    expect(focus!.isSkipLink, "the first Tab stop should be the skip link").toBe(true);
    expect(focus!.outlineStyle).not.toBe("none");
    expect(focus!.outlineWidth).toBeGreaterThan(0);
    // The halo: a spread-only shadow drawn around the element.
    expect(focus!.boxShadow, "the focus halo must be present").not.toBe("none");
  });

  test("keyboard focus is visible, not suppressed", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");

    const outline = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const style = getComputedStyle(el);
      return { width: style.outlineWidth, styleName: style.outlineStyle };
    });

    expect(outline, "Tab should move focus to an element").not.toBeNull();
    // globals.css sets a 2px brand outline on :focus-visible. `outline: none`
    // anywhere in the cascade would make the site unusable by keyboard while
    // looking identical to a mouse user.
    expect(outline!.styleName).not.toBe("none");
    expect(parseFloat(outline!.width)).toBeGreaterThan(0);
  });

  test("the page has exactly one h1", async ({ page }) => {
    await page.goto("/menu");
    await expect(page.locator("h1")).toHaveCount(1);
  });
});

test.describe("touch targets — WCAG 2.2 SC 2.5.8", () => {
  // Every interactive target is at least 24x24 CSS px. An automated
  // accessibility scan on the deployed site caught three 20px-tall text
  // links, among them the footer's phone and WhatsApp links — the highest
  // intent taps on the whole site, and the ones most likely to be reached
  // for one-handed on a phone.
  //
  // The skip link is the one exception: it is 1x1 until focused, which is
  // how a visually-hidden-until-focused control is supposed to behave.

  const PAGES = ["/", "/menu", "/product/margherita"];

  for (const path of PAGES) {
    test(`every target on ${path} is at least 24px`, async ({ page }) => {
      await page.setViewportSize({ width: 414, height: 900 });
      await page.goto(path);

      const small = await page.evaluate(() => {
        const out: { text: string; w: number; h: number }[] = [];
        const nodes = document.querySelectorAll("a, button, input, select, [role=button]");
        for (const el of Array.from(nodes)) {
          if (el.closest(".sr-only-focusable")) continue;
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) continue;
          if (getComputedStyle(el).display === "none") continue;
          if (rect.width >= 24 && rect.height >= 24) continue;
          out.push({
            text: (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 40),
            w: Math.round(rect.width),
            h: Math.round(rect.height),
          });
        }
        return out;
      });

      expect(
        small,
        `targets under 24px: ${small.map((s) => `"${s.text}" ${s.w}x${s.h}`).join(", ")}`
      ).toEqual([]);
    });
  }
});
