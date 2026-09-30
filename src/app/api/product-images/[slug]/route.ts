import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Serves a menu photograph the restaurant uploaded.
//
// Public, unlike the receipt route next door: this is a picture of a pizza on
// a menu, and the whole point is that anyone can see it. Cached hard and
// immutably, because the version in the query string changes whenever the
// photo does — so a long cache can never serve a stale one.

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (slug.length > 80) return new NextResponse(null, { status: 404 });

  const image = await prisma.productImage.findFirst({
    where: { product: { slug } },
    select: { data: true, contentType: true, byteSize: true },
  });
  if (!image) return new NextResponse(null, { status: 404 });

  return new NextResponse(new Uint8Array(image.data), {
    headers: {
      "Content-Type": image.contentType,
      "Content-Length": String(image.byteSize),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
