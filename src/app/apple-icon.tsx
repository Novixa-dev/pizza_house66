import { ImageResponse } from "next/og";
import { renderIcon } from "@/lib/og";

// iOS ignores SVG icons, so "Add to Home Screen" on an iPhone used to make a
// grey tile with a letter. This is the 180px PNG it looks for.

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  return new ImageResponse(await renderIcon(size.width, true), size);
}
