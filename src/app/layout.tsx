import type { Metadata, Viewport } from "next";
import { Cairo, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { getLocale, directionFor, pick } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { CartProvider } from "@/components/cart-context";
import { appUrl } from "@/lib/site";

// Cairo carries the Arabic; Plus Jakarta Sans carries Latin text and every
// number in the interface (see .numeric in globals.css for why).
const arabic = Cairo({
  variable: "--font-arabic",
  subsets: ["arabic", "latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const latin = Plus_Jakarta_Sans({
  variable: "--font-latin",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf7f1" },
    { media: "(prefers-color-scheme: dark)", color: "#14100b" },
  ],
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const title = pick(
    locale,
    "بيتزا هاوس المكلا | اطلب بيتزا أونلاين واستلم في وقتك",
    "Pizza House Al Mukalla | Order pizza online for pickup"
  );
  const description = pick(
    locale,
    "اطلب بيتزا طازجة من بيتزا هاوس في المكلا. تصفح القائمة، خصص طلبك، واختر وقت الاستلام المناسب لك.",
    "Order fresh pizza from Pizza House in Al Mukalla. Browse the menu, customize your order, and pick a collection time that suits you."
  );

  return {
    metadataBase: new URL(appUrl()),
    title: { default: title, template: `%s | ${t.common.siteName}` },
    description,
    applicationName: t.common.siteName,
    manifest: "/manifest.webmanifest",
    // Icons come from src/app/icon.tsx and apple-icon.tsx (real PNGs; iOS
    // ignores SVG), so none are declared here.
    category: "food",
    keywords: [
      "بيتزا هاوس المكلا",
      "Pizza House Mukalla",
      "مطعم بيتزا فوه",
      "حي المساكن فوه",
      "بيتزا المكلا",
      "طلب مسبق واستلام",
      "pizza_house66",
    ],
    appleWebApp: { capable: true, title: t.common.siteName, statusBarStyle: "default" },
    openGraph: {
      type: "website",
      siteName: t.common.siteName,
      title,
      description,
      locale: locale === "ar" ? "ar_YE" : "en_US",
      alternateLocale: locale === "ar" ? "en_US" : "ar_YE",
      url: appUrl(),
    },
    twitter: { card: "summary_large_image", title, description },
    // The site serves both languages from one set of URLs (see
    // docs/DECISIONS.md), so `alternate` points both hreflangs at the same
    // canonical rather than inventing URLs that don't exist.
    alternates: { canonical: "/" },
    robots: { index: true, follow: true },
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  const t = getDictionary(locale);

  return (
    <html
      lang={locale}
      dir={directionFor(locale)}
      className={`${latin.variable} ${arabic.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col antialiased">
        {/* First tab stop on every page: a keyboard user should not have to
            walk the whole nav to reach the menu (docs/PRD.md §50). */}
        <a
          href="#main"
          className="sr-only-focusable absolute start-4 top-4 z-50 rounded-[var(--radius-sm)] bg-brand px-4 py-2 font-semibold text-brand-ink"
        >
          {t.common.skipToContent}
        </a>
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
