import { NextRequest, NextResponse } from "next/server";
import { LOCALE_COOKIE_NAME } from "@/lib/i18n/locale";

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const locale = form.get("locale") === "en" ? "en" : "ar";
  const redirectTo = (form.get("redirectTo") as string) || "/";

  const response = NextResponse.redirect(new URL(redirectTo, request.url));
  response.cookies.set(LOCALE_COOKIE_NAME, locale, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  return response;
}
