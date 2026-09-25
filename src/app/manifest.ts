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
    icons: [
      { src: "/brand/logo.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/brand/icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "القائمة / Menu", url: "/menu" },
      { name: "السلة / Cart", url: "/cart" },
    ],
  };
}
