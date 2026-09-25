import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { isAnalyticsEvent, track } from "@/server/analytics";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";

// Receives the two funnel events that only the browser can observe
// (page_view, add_to_cart). Everything after checkout is recorded server-side.
//
// The session id comes from the HttpOnly cookie, never from the request body,
// so a client cannot write events into another visitor's session. Only names
// on the known event list are accepted — this is not a general-purpose log
// sink.

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().min(1).max(64),
  productId: z.string().max(64).optional(),
  valueMinor: z.number().int().min(0).max(100_000_000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  if (checkRateLimit(`analytics:${clientKey(request)}`, 60, 60_000).limited) {
    // Silently accepted: a throttled analytics beacon is not worth an error
    // in a customer's console.
    return new NextResponse(null, { status: 204 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success || !isAnalyticsEvent(parsed.data.name)) {
    return new NextResponse(null, { status: 204 });
  }

  const sessionId = (await cookies()).get("ph_sid")?.value ?? null;
  await track({
    name: parsed.data.name,
    sessionId,
    productId: parsed.data.productId ?? null,
    valueMinor: parsed.data.valueMinor ?? null,
    metadata: parsed.data.metadata as Record<string, string> | undefined,
  });

  return new NextResponse(null, { status: 204 });
}
