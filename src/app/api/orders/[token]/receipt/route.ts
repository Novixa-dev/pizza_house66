import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { decodeReceipt, ReceiptValidationError, sanitizeFilename, uploadReceiptSchema } from "@/server/order-schema";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";
import { track } from "@/server/analytics";

// Lets a customer attach (or replace) their transfer receipt after placing
// the order — they often pay from a banking app once the order reference is
// in hand, and forcing the receipt to be ready at checkout would lose orders.
//
// Authorization is the tracking token in the path: it is the same capability
// that lets them see the order at all. The token is compared against the
// order's own record, and the upload only proceeds while the payment is still
// awaiting review — a verified or rejected payment is closed.

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const rate = checkRateLimit(`receipt:${clientKey(request)}`, 6, 60_000);
  if (rate.limited) {
    return NextResponse.json(
      { error: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const { token } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const parsed = uploadReceiptSchema.safeParse({ ...(body as object), trackingToken: token });
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION_ERROR" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { trackingToken: token },
    select: { id: true, payment: { select: { id: true, method: true, status: true } } },
  });
  if (!order?.payment) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  if (order.payment.method !== "BANK_TRANSFER") {
    return NextResponse.json({ error: "NOT_APPLICABLE" }, { status: 409 });
  }
  if (order.payment.status === "VERIFIED" || order.payment.status === "PAID") {
    return NextResponse.json({ error: "ALREADY_VERIFIED" }, { status: 409 });
  }

  let decoded;
  try {
    decoded = decodeReceipt(parsed.data.contentType, parsed.data.dataBase64);
  } catch (error) {
    if (error instanceof ReceiptValidationError) {
      return NextResponse.json({ error: error.code }, { status: 400 });
    }
    throw error;
  }

  const originalName = sanitizeFilename(parsed.data.originalName);

  await prisma.$transaction(async (tx) => {
    await tx.paymentReceipt.upsert({
      where: { paymentId: order.payment!.id },
      create: {
        paymentId: order.payment!.id,
        contentType: decoded.contentType,
        byteSize: decoded.buffer.byteLength,
        data: new Uint8Array(decoded.buffer),
        originalName,
      },
      update: {
        contentType: decoded.contentType,
        byteSize: decoded.buffer.byteLength,
        data: new Uint8Array(decoded.buffer),
        originalName,
        uploadedAt: new Date(),
      },
    });

    // A receipt arriving after a rejection puts the payment back in the
    // review queue — the customer has corrected something.
    await tx.payment.update({
      where: { id: order.payment!.id },
      data: {
        status: "PENDING",
        ...(parsed.data.referenceNumber ? { referenceNumber: parsed.data.referenceNumber } : {}),
      },
    });
    await tx.paymentStatusHistory.create({
      data: {
        paymentId: order.payment!.id,
        fromStatus: order.payment!.status,
        toStatus: "PENDING",
        reason: "receipt_uploaded",
      },
    });
  });

  await track({ name: "payment_submitted", orderId: order.id });

  return NextResponse.json({ ok: true });
}
