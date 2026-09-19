import { NextRequest, NextResponse } from "next/server";
import { createOrderSchema } from "@/server/order-schema";
import {
  createOrder,
  InvalidPickupTimeError,
  OrderingPausedError,
  ProductUnavailableError,
  SlotFullError,
} from "@/server/orders";
import { ZodError } from "zod";

export async function POST(request: NextRequest) {
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

  try {
    const order = await createOrder(parsed.data);
    return NextResponse.json({
      reference: order.reference,
      trackingToken: order.trackingToken,
    });
  } catch (err) {
    if (err instanceof OrderingPausedError) {
      return NextResponse.json({ error: "ORDERING_PAUSED" }, { status: 409 });
    }
    if (err instanceof InvalidPickupTimeError) {
      return NextResponse.json(
        { error: "INVALID_PICKUP_TIME", earliestValid: err.earliestValid.toISOString() },
        { status: 422 }
      );
    }
    if (err instanceof SlotFullError) {
      return NextResponse.json(
        { error: "SLOT_FULL", suggestedAt: err.suggestedAt.toISOString() },
        { status: 409 }
      );
    }
    if (err instanceof ProductUnavailableError) {
      return NextResponse.json({ error: "PRODUCT_UNAVAILABLE", message: err.message }, { status: 409 });
    }
    console.error("Order creation failed", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
