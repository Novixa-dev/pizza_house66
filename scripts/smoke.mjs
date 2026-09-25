/**
 * Post-deploy smoke check.
 *
 * Answers one question about a running deployment — "is this actually
 * serving, and are the things that must never be public still private?" —
 * without creating an order or touching any data. Safe to run against a live
 * restaurant, and fast enough to run on every deploy.
 *
 *   node scripts/smoke.mjs https://your-domain.com
 *   npm run smoke -- https://your-domain.com
 *
 * Exits non-zero on the first genuine failure, so it can gate a release.
 * The full behavioural suite is `npm run test:e2e` (docs/TESTING.md); this is
 * the check you run when the suite is too slow to be in the deploy path.
 */

const base = (process.argv[2] ?? process.env.SMOKE_BASE_URL ?? "").replace(/\/$/, "");
if (!base) {
  console.error("Usage: node scripts/smoke.mjs <base-url>");
  process.exit(2);
}

let failures = 0;
let checks = 0;

function report(ok, label, detail) {
  checks += 1;
  if (ok) {
    console.log(`  ok    ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function fetchNoRedirect(path, init) {
  return fetch(`${base}${path}`, { redirect: "manual", ...init });
}

async function main() {
  console.log(`\nSmoke-testing ${base}\n`);

  // --- The public site renders -------------------------------------------
  for (const [path, label] of [
    ["/", "home page responds 200"],
    ["/menu", "menu responds 200"],
    ["/cart", "cart responds 200"],
    ["/checkout", "checkout responds 200"],
  ]) {
    try {
      const res = await fetchNoRedirect(path);
      report(res.status === 200, label, `got ${res.status}`);
    } catch (error) {
      report(false, label, String(error));
    }
  }

  // The home page must contain real restaurant data, not an empty shell —
  // a 200 from a page that failed to load its restaurant row is still broken.
  //
  // Both assertions check the status too: an error page is long and would
  // otherwise satisfy a naive length check, which is exactly the false pass
  // a smoke test must not give.
  try {
    const res = await fetch(`${base}/`);
    const html = await res.text();
    report(
      res.ok && html.includes("application/ld+json"),
      "home page emits structured data",
      `status ${res.status}`
    );
    report(
      res.ok && html.includes('"@type":"Restaurant"'),
      "home page carries the restaurant's own data",
      res.ok ? "Restaurant JSON-LD missing" : `status ${res.status}`
    );
  } catch (error) {
    report(false, "home page body readable", String(error));
  }

  // --- SEO surfaces -------------------------------------------------------
  for (const [path, needle, label] of [
    ["/robots.txt", "Sitemap", "robots.txt served"],
    ["/sitemap.xml", "<urlset", "sitemap.xml served"],
    ["/manifest.webmanifest", "start_url", "PWA manifest served"],
  ]) {
    try {
      const res = await fetch(`${base}${path}`);
      const body = await res.text();
      report(res.status === 200 && body.includes(needle), label, `status ${res.status}`);
    } catch (error) {
      report(false, label, String(error));
    }
  }

  // --- Staff areas are closed --------------------------------------------
  for (const [path, label] of [
    ["/admin", "admin redirects an anonymous visitor"],
    ["/kitchen", "kitchen redirects an anonymous visitor"],
    ["/admin/settings", "admin settings redirects an anonymous visitor"],
  ]) {
    try {
      const res = await fetchNoRedirect(path);
      const location = res.headers.get("location") ?? "";
      report(
        res.status >= 300 && res.status < 400 && location.includes("/admin/login"),
        label,
        `status ${res.status}, location ${location || "(none)"}`
      );
    } catch (error) {
      report(false, label, String(error));
    }
  }

  try {
    const res = await fetchNoRedirect("/api/receipts/does-not-exist");
    report(res.status === 401, "receipt route refuses an anonymous request", `got ${res.status}`);
  } catch (error) {
    report(false, "receipt route refuses an anonymous request", String(error));
  }

  try {
    const res = await fetchNoRedirect("/api/cron/release-orders");
    report(res.status === 401, "cron endpoint refuses an unauthenticated trigger", `got ${res.status}`);
  } catch (error) {
    report(false, "cron endpoint refuses an unauthenticated trigger", String(error));
  }

  // --- Hardening headers --------------------------------------------------
  try {
    const res = await fetch(`${base}/`);
    const csp = res.headers.get("content-security-policy") ?? "";
    report(csp.includes("frame-ancestors 'none'"), "CSP present with frame-ancestors");
    report(csp.includes("form-action 'self'"), "CSP present with form-action");
    report(
      res.headers.get("x-content-type-options") === "nosniff",
      "X-Content-Type-Options: nosniff"
    );
    report(res.headers.get("x-frame-options") === "DENY", "X-Frame-Options: DENY");
    // Only meaningful over HTTPS, which is where this is meant to run.
    if (base.startsWith("https://")) {
      report(
        csp.includes("upgrade-insecure-requests"),
        "CSP upgrades insecure requests over HTTPS"
      );
    }
  } catch (error) {
    report(false, "security headers readable", String(error));
  }

  // --- The order API validates rather than crashing -----------------------
  try {
    const res = await fetch(`${base}/api/orders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nonsense: true }),
    });
    const body = await res.json().catch(() => ({}));
    report(
      res.status === 400 && body.error === "VALIDATION_ERROR",
      "order API rejects a malformed body with a validation error",
      `status ${res.status}, error ${body.error}`
    );
  } catch (error) {
    report(false, "order API reachable", String(error));
  }

  console.log(
    `\n${checks - failures}/${checks} checks passed${failures ? ` — ${failures} FAILED` : ""}\n`
  );
  process.exit(failures ? 1 : 0);
}

main().catch((error) => {
  console.error("smoke check crashed:", error);
  process.exit(1);
});
