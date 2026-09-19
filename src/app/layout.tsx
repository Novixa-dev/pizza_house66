import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Cairo } from "next/font/google";
import "./globals.css";
import { getLocale } from "@/lib/i18n/locale";
import { CartProvider } from "@/components/cart-context";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getRestaurant } from "@/server/restaurant";

const geistSans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const cairo = Cairo({ variable: "--font-arabic", subsets: ["arabic", "latin"] });

export const metadata: Metadata = {
  title: {
    default: "بيتزا هاوس | Pizza House — المكلا",
    template: "%s | Pizza House",
  },
  description:
    "اطلب من بيتزا هاوس في المكلا مسبقًا واختر وقت الاستلام — Order ahead from Pizza House in Al Mukalla and pick a pickup time.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  const dir = locale === "ar" ? "rtl" : "ltr";
  const restaurant = await getRestaurant();

  return (
    <html lang={locale} dir={dir} className={`${geistSans.variable} ${cairo.variable} h-full`}>
      <body className="min-h-full flex flex-col antialiased">
        <CartProvider>
          <SiteHeader locale={locale} />
          <main className="flex-1">{children}</main>
          <SiteFooter locale={locale} restaurant={restaurant} />
        </CartProvider>
      </body>
    </html>
  );
}
