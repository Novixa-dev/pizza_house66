import { ImageResponse } from "next/og";
import { OG_SIZE, loadLeadPhoto, ogFonts, renderBrandCard } from "@/lib/og";

// Same card as the Open Graph one. X and some chat apps read this tag
// separately and show nothing when it is missing.

export const alt = "بيتزا هاوس المكلا — اطلب مسبقًا، استلم طازجًا";
export const size = OG_SIZE;
export const contentType = "image/png";
export const revalidate = 3600;

export default async function TwitterImage() {
  const [card, fonts] = await Promise.all([loadLeadPhoto().then(renderBrandCard), ogFonts()]);
  return new ImageResponse(card, { ...size, fonts });
}
