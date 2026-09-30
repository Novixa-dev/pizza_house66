import { NextResponse, type NextRequest } from "next/server";
import { releaseDueOrders } from "@/server/orders";
import { timingSafeEqual } from "node:crypto";

// Scheduled kitchen release.
//
// This is the piece that makes scheduled ordering real without anyone
// watching a screen: a cron hit promotes every CONFIRMED order whose
// kitchenReleaseAt has arrived into the kitchen queue (docs/PRD.md §13, §26).
// The admin and kitchen pages call the same function opportunistically, so
// the behaviour degrades gracefully if the schedule is not configured — see
// vercel.json for the schedule itself.

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  // Without a configured secret the endpoint stays closed rather than open:
  // an unauthenticated trigger could be used to hammer the database.
  if (!secret) return false;

  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  const expected = Buffer.from(secret);
  const actual = Buffer.from(provided);
  // Compare in constant time, and only when the lengths match — timingSafeEqual
  // throws on mismatched buffers.
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function handle(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const released = await releaseDueOrders();
    return NextResponse.json({ ok: true, released });
  } catch (error) {
    console.error("[cron/release-orders] failed", error);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

// Vercel Cron issues GET; POST is accepted so any external scheduler works.
export const GET = handle;
export const POST = handle;
