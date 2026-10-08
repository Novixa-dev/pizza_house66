import type { MetadataRoute } from "next";

// PWA manifest (docs/PROJECT_ORIGIN.md §37).
//
// Installable so a regular can keep Pizza House on their home screen instead
// of hunting for the link. Deliberately not an offline app: ordering needs
// live availability and live slot capacity, so pretending to work offline
// would only produce orders the restaurant can't honour.

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "بيتزا هاوس — Pizza House",
    short_name: "Pizza House",
    description:
      "اطلب مسبقًا واختر وقت الاستلام — Order ahead and choose your pickup time.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fbf7f1",
    theme_color: "#a8261c",
    lang: "ar",
    dir: "rtl",
    categories: ["food", "shopping"],
    id: "/",
    // PNGs first: Chrome will not offer to install on an SVG alone everywhere,
    // and iOS reads none of them (it uses apple-icon). The SVG stays for
    // browsers that prefer it.
    icons: [
      { src: "/pwa-icon/192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/brand/logo.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
    shortcuts: [
      { name: "القائمة / Menu", url: "/menu" },
      { name: "طلباتي / My orders", url: "/orders" },
      { name: "السلة / Cart", url: "/cart" },
    ],
  };
}
