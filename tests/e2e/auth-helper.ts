import type { BrowserContext, Cookie, Page } from "@playwright/test";

/**
 * Signs a staff member in once per role and reuses the session cookie.
 *
 * Re-authenticating in every test trips the per-account login rate limit
 * (5 attempts / 5 minutes), which is the limiter doing its job — see the
 * dedicated test that asserts it — but it would make every other test flaky
 * for a reason unrelated to what it is checking. Caching the cookie is also
 * simply faster.
 */

const PASSWORD = process.env.SEED_STAFF_PASSWORD ?? "ChangeMe123!";
const SESSION_COOKIE = "ph_session";

const cache = new Map<string, Cookie>();

export async function signInAs(page: Page, email: string): Promise<void> {
  const cached = cache.get(email);
  if (cached) {
    await applyCookie(page.context(), cached);
    return;
  }

  await page.goto("/admin/login");
  await page.getByLabel(/email|البريد/i).fill(email);
  await page.getByLabel(/password|كلمة المرور/i).fill(PASSWORD);
  await page.getByRole("button", { name: /sign in|دخول/i }).click();

  // Wait for a destination that is NOT the login page — matching /admin
  // alone is satisfied by /admin/login itself, so the test would race ahead
  // without a session and every later assertion would fail confusingly.
  await page.waitForURL((url) => !url.pathname.startsWith("/admin/login"));

  const cookie = (await page.context().cookies()).find((c) => c.name === SESSION_COOKIE);
  if (!cookie) throw new Error(`Sign-in as ${email} produced no session cookie`);
  cache.set(email, cookie);
}

async function applyCookie(context: BrowserContext, cookie: Cookie): Promise<void> {
  await context.addCookies([
    {
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path,
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: cookie.sameSite,
      expires: cookie.expires,
    },
  ]);
}

/** Forgets cached sessions — used by the test that exercises the rate limit. */
export function clearSessionCache(): void {
  cache.clear();
}
