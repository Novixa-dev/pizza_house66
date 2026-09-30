import type { Metadata } from "next";
import { getLocale, pick } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getRestaurant, restaurantStatus } from "@/server/restaurant";
import { formatOpeningHours } from "@/lib/hours-display";
import { telLink, whatsappLink } from "@/lib/site";
import { buildMetadata } from "@/lib/seo";
import { Badge, Card, SectionHeading } from "@/components/ui";
import { InstagramIcon, PhoneIcon, PinIcon, WhatsappIcon } from "@/components/ui/icons";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = getDictionary(locale);
  return buildMetadata({
    title: t.pages.contactTitle,
    description: t.pages.contactLead,
    path: "/contact",
    locale,
  });
}

export const dynamic = "force-dynamic";

export default async function ContactPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const restaurant = await getRestaurant();
  const status = restaurantStatus(restaurant);
  const hours = formatOpeningHours(restaurant.businessHours, locale, t.hours.days);
  const address = pick(locale, restaurant.addressAr, restaurant.addressEn);
  const tel = telLink(restaurant.phone);
  const whatsapp = whatsappLink(restaurant.whatsapp);

  // Each way of reaching the restaurant is a tap target of its own rather
  // than a line of text with a number in it: on a phone, "call us" that does
  // not dial is a phone number you have to memorize and retype.
  const channels = [
    tel
      ? {
          href: tel,
          icon: <PhoneIcon className="text-brand" />,
          label: t.pages.contactCall,
          value: restaurant.phone,
          external: false,
        }
      : null,
    whatsapp
      ? {
          href: whatsapp,
          icon: <WhatsappIcon className="text-accent" />,
          label: t.pages.contactWhatsapp,
          value: restaurant.whatsapp,
          external: true,
        }
      : null,
    restaurant.mapUrl
      ? {
          href: restaurant.mapUrl,
          icon: <PinIcon className="text-brand" />,
          label: t.pages.contactVisit,
          value: address,
          external: true,
        }
      : null,
    restaurant.instagramUrl
      ? {
          href: restaurant.instagramUrl,
          icon: <InstagramIcon />,
          label: t.pages.contactSocial,
          value: "@pizza_house66",
          external: true,
        }
      : null,
  ].filter((channel) => channel !== null);

  return (
    <div className="container-page max-w-4xl py-10">
      <SectionHeading level={1} title={t.pages.contactTitle} subtitle={t.pages.contactLead} />

      <ul className="grid gap-3 sm:grid-cols-2">
        {channels.map((channel) => (
          <li key={channel.label}>
            <a
              href={channel.href}
              {...(channel.external ? { target: "_blank", rel: "noreferrer" } : {})}
              className="flex min-h-16 items-center gap-4 rounded-[var(--radius)] border border-line bg-surface p-4 transition-colors hover:border-brand/40 hover:bg-surface-muted"
            >
              <span className="shrink-0 text-2xl">{channel.icon}</span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  {channel.label}
                </span>
                <span className="block font-semibold text-ink" dir={channel.external && channel.label === t.pages.contactVisit ? undefined : "auto"}>
                  {channel.value}
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>

      <Card className="mt-8 p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-bold text-ink">{t.pages.contactHours}</h2>
          <Badge tone={status.open ? "success" : "neutral"}>
            {status.open ? t.common.openNow : t.common.closedNow}
          </Badge>
        </div>
        <dl className="space-y-2.5">
          {hours.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-4 text-sm">
              <dt className="text-ink-soft">{row.label}</dt>
              <dd className={row.closed ? "text-ink-muted" : "numeric font-semibold text-ink"}>
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}
