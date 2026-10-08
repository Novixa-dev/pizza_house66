import { ImageResponse } from "next/og";
import { renderIcon } from "@/lib/og";

// The PNG icons the web app manifest points at. Chrome wants a 192px and a
// 512px PNG before it will offer to install the site; an SVG alone does not
// meet that bar everywhere, and a maskable variant stops the launcher from
// cropping the logo to a sliver.

const ICONS: Record<string, { size: number; maskable: boolean }> = {
  "192.png": { size: 192, maskable: false },
  "512.png": { size: 512, maskable: false },
  "maskable-512.png": { size: 512, maskable: true },
};

export const dynamic = "force-static";

export function generateStaticParams() {
  return Object.keys(ICONS).map((name) => ({ name }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const icon = ICONS[name];
  if (!icon) return new Response("Not found", { status: 404 });
  return new ImageResponse(await renderIcon(icon.size, icon.maskable), {
    width: icon.size,
    height: icon.size,
    headers: { "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
