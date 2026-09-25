import { NextResponse, type NextRequest } from "next/server";
import { promoPreviewSchema } from "@/server/order-schema";
import { previewPromotion } from "@/server/orders";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";

// Prices a promo code against a basket without creating anything.
//
// Rate limited more tightly than order creation: an unthrottled preview
// endpoint is a code-guessing oracle.

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const rate = checkRateLimit(`promo:${clientKey(request)}`, 15, 60_000);
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

  const parsed = promoPreviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION_ERROR" }, { status: 400 });
  }

  try {
    const preview = await previewPromotion(parsed.data.code, parsed.data.items);
    return NextResponse.json(preview);
  } catch (error) {
    console.error("[api/promotions/preview] failed", error);
    // A basket that can't be priced (a product just went hidden, say) is not
    // an error the customer needs to see here — it simply has no discount,
    // and checkout will tell them what's actually wrong.
    return NextResponse.json({ valid: false, discountMinor: 0, reasonCode: "NOT_FOUND" });
  }
}
