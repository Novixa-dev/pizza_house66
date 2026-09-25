import type { NextRequest } from "next/server";
import { LOCALE_COOKIE_NAME } from "@/lib/i18n/pick";
import { ensureSameOriginPath, redirectSameOrigin } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const locale = form.get("locale") === "en" ? "en" : "ar";

  // Only same-site paths: an absolute or protocol-relative value here would
  // turn the language switcher into an open redirect.
  const redirectTo = ensureSameOriginPath(String(form.get("redirectTo") ?? "/"));

  const response = redirectSameOrigin(redirectTo);
  response.cookies.set(LOCALE_COOKIE_NAME, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    // Secure only over HTTPS; a Secure cookie on an http:// origin is dropped.
    secure: request.nextUrl.protocol === "https:",
  });
  return response;
}
