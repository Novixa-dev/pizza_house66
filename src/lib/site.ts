// Absolute-URL resolution.
//
// Canonical links, Open Graph tags, the sitemap and the order-tracking link
// all need a real origin. In order of trust: an explicitly configured public
// URL, then the URL the host tells us it deployed to, then localhost.

export function appUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return stripTrailingSlash(configured);

  // Set automatically on Vercel; `VERCEL_PROJECT_PRODUCTION_URL` is the stable
  // production hostname, while `VERCEL_URL` is the per-deployment one.
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (production) return `https://${production}`;
  const deployment = process.env.VERCEL_URL;
  if (deployment) return `https://${deployment}`;

  // Railway sets this on every service that has a domain. Reading it costs
  // nothing and closes a failure that is invisible in the browser: with no
  // configured URL, the deployed site advertised `og:url` as
  // http://localhost:3000 — so every link shared to WhatsApp resolved to the
  // sharer's own machine. Nothing on the page looks wrong; the damage is all
  // in the metadata, which is exactly why it went unnoticed.
  const railway = process.env.RAILWAY_PUBLIC_DOMAIN;
  if (railway) return `https://${railway}`;

  return "http://localhost:3000";
}

function stripTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

export function absoluteUrl(path: string): string {
  return `${appUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Builds a wa.me link from a stored phone number in any human format. */
export function whatsappLink(whatsapp: string | null | undefined, message?: string): string | null {
  if (!whatsapp) return null;
  const digits = whatsapp.replace(/\D/g, "");
  if (digits.length < 8) return null;
  const query = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${digits}${query}`;
}

export function telLink(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/[^\d+]/g, "");
  return cleaned.length >= 6 ? `tel:${cleaned}` : null;
}
