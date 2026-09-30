import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { recordAudit } from "@/server/audit";

// Serves a payment receipt image to authorized staff only.
//
// This is the whole point of storing receipts in the database rather than in
// a public folder: there is no URL that works without a session, the file is
// never reachable by guessing a filename, and every view is auditable
// (docs/PRD.md §42, §73 "unauthorized receipt access").
//
// A customer's own receipt is served by a separate, token-scoped route.

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return new NextResponse(null, { status: 401 });
  }
  if (!can(session.role, "payments.receipt.read")) {
    // 404 rather than 403: an unauthorized user learns nothing about whether
    // the receipt exists.
    return new NextResponse(null, { status: 404 });
  }

  const { paymentId } = await params;
  const receipt = await prisma.paymentReceipt.findUnique({
    where: { paymentId },
    select: { data: true, contentType: true, byteSize: true, payment: { select: { orderId: true } } },
  });
  if (!receipt) return new NextResponse(null, { status: 404 });

  await recordAudit({
    actor: { id: session.userId, name: session.name },
    action: "payment.receipt.view",
    entity: "Payment",
    entityId: paymentId,
    metadata: { orderId: receipt.payment.orderId },
  });

  return new NextResponse(new Uint8Array(receipt.data), {
    headers: {
      "Content-Type": receipt.contentType,
      "Content-Length": String(receipt.byteSize),
      // Private and uncacheable: a receipt must not linger in a shared cache
      // or a CDN after the staff member's session ends.
      "Cache-Control": "private, no-store",
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
