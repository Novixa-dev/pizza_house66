import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { createOrderSchema, ReceiptValidationError } from "@/server/order-schema";
import {
  BelowMinimumOrderError,
  createOrder,
  InvalidOptionsError,
  InvalidPickupTimeError,
  NoSlotsAvailableError,
  OrderingPausedError,
  ProductUnavailableError,
  SlotFullError,
} from "@/server/orders";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";
import { cookies } from "next/headers";

// The one write endpoint a customer can reach.
//
// It is a route handler rather than a Server Action because the checkout form
// needs to branch on *which* rule rejected the order — a full slot, a closed
// kitchen, a sold-out item all get different copy — and because this is the
// one path a future POS integration or native client would also call.
//
// Errors are mapped to stable machine codes. Nothing internal (stack traces,
// SQL, ids the customer has no business seeing) crosses this boundary
// (docs/PRD.md §62).

export const dynamic = "force-dynamic";

// Anti-abuse, not anti-duplicate: the idempotency key is what stops a
// double-clicked submit from becoming two orders. A throttle tight enough to
// catch that would also catch a real burst — several people ordering from one
// café or office connection, or a family behind a single home address all
// share an IP. This window is wide enough for those and still narrow enough
// that scripted spam hits it quickly.
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 5 * 60_000;

export async function POST(request: NextRequest) {
  const rate = checkRateLimit(`orders:${clientKey(request)}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (rate.limited) {
    return NextResponse.json(
      { error: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", details: (parsed.error as ZodError).flatten() },
      { status: 400 }
    );
  }

  // The analytics session is a server-side cookie; taking it from the request
  // rather than the body means the client cannot attribute its order to
  // someone else's funnel.
  const sessionId = (await cookies()).get("ph_sid")?.value;

  try {
    const order = await createOrder({ ...parsed.data, sessionId });
    return NextResponse.json(
      {
        reference: order.reference,
        trackingToken: order.trackingToken,
        totalMinor: order.totalMinor,
        requestedPickupAt: order.requestedPickupAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}

function errorResponse(error: unknown): NextResponse {
  if (error instanceof OrderingPausedError) {
    return NextResponse.json({ error: "ORDERING_PAUSED" }, { status: 409 });
  }
  if (error instanceof InvalidPickupTimeError) {
    return NextResponse.json(
      {
        error: "INVALID_PICKUP_TIME",
        reasonCode: error.reasonCode,
        earliestValid: error.earliestValid?.toISOString() ?? null,
      },
      { status: 422 }
    );
  }
  if (error instanceof SlotFullError) {
    return NextResponse.json(
      { error: "SLOT_FULL", suggestedAt: error.suggestedAt?.toISOString() ?? null },
      { status: 409 }
    );
  }
  if (error instanceof ProductUnavailableError) {
    return NextResponse.json(
      {
        error: "PRODUCT_UNAVAILABLE",
        productNameAr: error.productNameAr,
        productNameEn: error.productNameEn,
      },
      { status: 409 }
    );
  }
  if (error instanceof NoSlotsAvailableError) {
    return NextResponse.json({ error: "NO_SLOTS" }, { status: 409 });
  }
  if (error instanceof BelowMinimumOrderError) {
    return NextResponse.json(
      { error: "BELOW_MINIMUM", minimumMinor: error.minimumMinor },
      { status: 422 }
    );
  }
  if (error instanceof ReceiptValidationError) {
    return NextResponse.json({ error: error.code }, { status: 400 });
  }
  if (error instanceof InvalidOptionsError) {
    // The message names an option group, not an internal identifier, so it is
    // safe to return; it only ever fires on a tampered or stale request.
    return NextResponse.json({ error: "INVALID_OPTIONS", message: error.message }, { status: 400 });
  }

  console.error("[api/orders] unhandled failure", error);
  return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
}
