import { NextRequest, NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  await destroySession();
  return NextResponse.redirect(new URL("/admin/login", request.url));
}
