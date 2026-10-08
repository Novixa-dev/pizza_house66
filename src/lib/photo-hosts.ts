// Where the server may fetch a product photograph from.
//
// These are the two hosts `next.config.ts` already lets the image optimizer
// fetch, and for the same reason: a URL a staff member pastes into the admin
// must not turn this server into a proxy for arbitrary hosts. Anything that
// fetches a photo on the server (the social-card renderer) checks here first.

export const PHOTO_HOSTS: ReadonlySet<string> = new Set(["images.unsplash.com", "upload.wikimedia.org"]);

export function isAllowedPhotoUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    // Credentials in a URL are never legitimate for a photograph, and
    // `user@host` forms are how look-alike links are dressed up.
    return url.protocol === "https:" && !url.username && !url.password && PHOTO_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}
