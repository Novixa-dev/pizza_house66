import { afterEach, describe, expect, it, vi } from "vitest";
import { absoluteUrl, appUrl, telLink, whatsappLink } from "@/lib/site";

// The origin these build is the one that goes into every canonical link, every
// Open Graph tag, the sitemap, and the tracking link a customer is sent. It
// being wrong is invisible on the page and obvious to everyone the link is
// shared with, so it is worth pinning precisely.

const ORIGINAL = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL };
  vi.unstubAllEnvs();
});

function only(vars: Record<string, string | undefined>) {
  for (const key of [
    "NEXT_PUBLIC_APP_URL",
    "VERCEL_PROJECT_PRODUCTION_URL",
    "VERCEL_URL",
    "RAILWAY_PUBLIC_DOMAIN",
  ]) {
    delete process.env[key];
  }
  for (const [key, value] of Object.entries(vars)) {
    if (value !== undefined) process.env[key] = value;
  }
}

describe("appUrl", () => {
  it("prefers what was configured explicitly", () => {
    only({
      NEXT_PUBLIC_APP_URL: "https://pizzahouse66.ye",
      RAILWAY_PUBLIC_DOMAIN: "app-production.up.railway.app",
    });
    expect(appUrl()).toBe("https://pizzahouse66.ye");
  });

  it("drops a trailing slash so paths do not double up", () => {
    only({ NEXT_PUBLIC_APP_URL: "https://pizzahouse66.ye/" });
    expect(absoluteUrl("/menu")).toBe("https://pizzahouse66.ye/menu");
  });

  it("falls back to the Railway domain rather than to localhost", () => {
    // This is the production bug: with nothing configured, the deployed site
    // advertised og:url as http://localhost:3000 and every shared link
    // pointed at the sharer's own machine.
    only({ RAILWAY_PUBLIC_DOMAIN: "app-production-656a.up.railway.app" });
    expect(appUrl()).toBe("https://app-production-656a.up.railway.app");
  });

  it("prefers Vercel's stable hostname over its per-deployment one", () => {
    only({
      VERCEL_PROJECT_PRODUCTION_URL: "pizzahouse.vercel.app",
      VERCEL_URL: "pizzahouse-abc123.vercel.app",
    });
    expect(appUrl()).toBe("https://pizzahouse.vercel.app");
  });

  it("only reaches localhost when nothing at all is set", () => {
    only({});
    expect(appUrl()).toBe("http://localhost:3000");
  });

  it("joins a path with or without a leading slash", () => {
    only({ NEXT_PUBLIC_APP_URL: "https://pizzahouse66.ye" });
    expect(absoluteUrl("menu")).toBe("https://pizzahouse66.ye/menu");
    expect(absoluteUrl("/menu")).toBe("https://pizzahouse66.ye/menu");
  });
});

describe("whatsappLink", () => {
  it("strips formatting to the digits wa.me expects", () => {
    expect(whatsappLink("+967 772 207 788")).toBe("https://wa.me/967772207788");
    expect(whatsappLink("00967-772207788")).toBe("https://wa.me/00967772207788");
  });

  it("encodes a prefilled message", () => {
    const link = whatsappLink("+967772207788", "طلبي رقم PH-1234");
    expect(link).toContain("?text=");
    expect(decodeURIComponent(link!.split("text=")[1]!)).toBe("طلبي رقم PH-1234");
  });

  it("returns nothing rather than a broken link", () => {
    expect(whatsappLink(null)).toBeNull();
    expect(whatsappLink("")).toBeNull();
    expect(whatsappLink("12345")).toBeNull();
  });
});

describe("telLink", () => {
  it("keeps the plus and the digits and nothing else", () => {
    expect(telLink("+967 5 375561")).toBe("tel:+9675375561");
    expect(telLink("05375561")).toBe("tel:05375561");
  });

  it("returns nothing for a number too short to dial", () => {
    expect(telLink(null)).toBeNull();
    expect(telLink("123")).toBeNull();
  });
});
