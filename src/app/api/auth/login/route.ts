import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { isRateLimited } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? "/admin/orders");

  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (isRateLimited(`login:${ip}`, 10, 60_000)) {
    const url = new URL("/admin/login", request.url);
    url.searchParams.set("error", "rate_limited");
    return NextResponse.redirect(url);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const passwordOk = user ? await bcrypt.compare(password, user.passwordHash) : false;

  if (!user || !user.active || !passwordOk) {
    const url = new URL("/admin/login", request.url);
    url.searchParams.set("error", "1");
    return NextResponse.redirect(url);
  }

  await createSession({ userId: user.id, role: user.role, name: user.name });
  return NextResponse.redirect(new URL(next, request.url));
}
