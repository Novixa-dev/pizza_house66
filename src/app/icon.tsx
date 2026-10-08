import { ImageResponse } from "next/og";
import { renderIcon } from "@/lib/og";

// The browser-tab icon. The file Next scaffolds here is its own logo, so a
// tab, a bookmark and a history entry showed someone else's mark.

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default async function Icon() {
  return new ImageResponse(await renderIcon(size.width, false), size);
}
