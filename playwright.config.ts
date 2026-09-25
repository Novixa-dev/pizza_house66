import { defineConfig, devices } from "@playwright/test";

// E2E configuration (docs/PRD.md §72.3, §74).
//
// The suite runs against a real production build with a real database — a
// mocked ordering flow would prove nothing about the thing this product
// actually has to get right. `PLAYWRIGHT_BASE_URL` points it at an already
// running server (including a deployed one); otherwise it starts one.

const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3111);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${PORT}`;

// Some CI images ship a Chromium build that doesn't match the version
// Playwright would download. Setting PLAYWRIGHT_CHROMIUM_PATH points the
// runner at the browser that is actually installed instead of failing on a
// download that the sandbox blocks. Unset locally, where `npx playwright
// install` does the right thing.
const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
const launchOptions = chromiumPath ? { executablePath: chromiumPath } : undefined;

export default defineConfig({
  testDir: "./tests/e2e",
  // Clears orders from previous runs so pickup-slot capacity does not
  // accumulate across runs and fail the suite for unrelated reasons.
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false, // the suite shares one restaurant's data and slot capacity
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  timeout: 45_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // Arabic is the primary deployment language, so the default project
    // exercises the RTL layout rather than treating it as a variant.
    locale: "ar-YE",
    timezoneId: "Asia/Aden",
  },

  projects: [
    {
      name: "mobile-ar",
      use: { ...devices["Pixel 7"], locale: "ar-YE", timezoneId: "Asia/Aden", launchOptions },
    },
    {
      name: "desktop-en",
      use: { ...devices["Desktop Chrome"], locale: "en-GB", timezoneId: "Asia/Aden", launchOptions },
    },
  ],

  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: `npm run start -- --port ${PORT}`,
        url: `http://127.0.0.1:${PORT}`,
        // Never reuse: a server left running from before the last build
        // serves a stale asset manifest, the page loads unstyled, and the
        // suite fails with baffling "element intercepts pointer events"
        // errors that have nothing to do with the code under test.
        reuseExistingServer: false,
        timeout: 120_000,
      },
});
