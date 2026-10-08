import { ImageResponse } from "next/og";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { OG_SIZE, loadLeadPhoto, loadProductPhoto, ogFonts, renderBrandCard, renderProductCard } from "@/lib/og";
import { getRestaurant } from "@/server/restaurant";

// A product's own link card: its photograph, its name, its price. A dish
// sent to a friend on WhatsApp is the most natural way this site gets shared,
// and a generic restaurant card under a specific dish wastes it.

export const alt = "بيتزا هاوس المكلا";
export const size = OG_SIZE;
export const contentType = "image/png";
export const revalidate = 3600;

export default async function ProductOpengraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const fonts = await ogFonts();

  const product = await prisma.product
    .findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        imageUrl: true,
        nameAr: true,
        nameEn: true,
        basePriceMinor: true,
        availability: true,
        category: { select: { nameAr: true } },
      },
    })
    .catch(() => null);

  // An unknown or hidden product gets the restaurant's card, never an error
  // and never a hint that something hidden exists.
  if (!product || product.availability === "HIDDEN") {
    return new ImageResponse(await renderBrandCard(await loadLeadPhoto()), { ...size, fonts });
  }

  const [photo, restaurant] = await Promise.all([loadProductPhoto(product), getRestaurant()]);
  const card = await renderProductCard({
    photo,
    category: product.category.nameAr,
    nameAr: product.nameAr,
    nameEn: product.nameEn,
    price: formatMoney(product.basePriceMinor, restaurant.currency, "ar"),
  });
  return new ImageResponse(card, { ...size, fonts });
}
