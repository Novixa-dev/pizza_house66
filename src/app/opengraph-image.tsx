import { ImageResponse } from "next/og";
import { OG_SIZE, loadLeadPhoto, ogFonts, renderBrandCard } from "@/lib/og";

// The card every page without a card of its own shares (docs/PRD.md §51).
// Drawn by src/lib/og.tsx; the photograph is the featured dish when it can be
// fetched and a plain brand card when it cannot.

export const alt = "بيتزا هاوس المكلا — اطلب مسبقًا، استلم طازجًا";
export const size = OG_SIZE;
export const contentType = "image/png";
export const revalidate = 3600;

export default async function OpengraphImage() {
  const [card, fonts] = await Promise.all([loadLeadPhoto().then(renderBrandCard), ogFonts()]);
  return new ImageResponse(card, { ...size, fonts });
}
