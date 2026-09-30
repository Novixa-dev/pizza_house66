// Where a menu item's picture comes from.
//
// Three sources, in order of how much the restaurant owns them:
//
//   1. A photograph the restaurant uploaded, served from the database.
//      Theirs, of their food, and the only one worth having.
//   2. A URL typed into the admin — their Instagram, a CDN, stock.
//   3. The illustration that ships with the app, so a new item is never a
//      grey rectangle before anyone has had time to photograph it.
//
// Resolution lives here rather than in each component because the menu, the
// product page, the cart, the order page and the kitchen screen all ask the
// same question, and they must all answer it the same way.

export const PRODUCT_IMAGE_MAX_BYTES = 4 * 1024 * 1024;
export const PRODUCT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export interface ProductImageSource {
  slug: string;
  imageUrl?: string | null;
  image?: { version: string } | null;
}

/**
 * The URL to render for a product.
 *
 * The uploaded photo carries its version in the path, so replacing a photo
 * changes the URL — otherwise a browser or a CDN that cached the old one
 * would keep serving it, and the owner would conclude the upload failed and
 * do it again.
 */
export function productImageUrl(product: ProductImageSource): string {
  if (product.image) return `/api/product-images/${product.slug}?v=${product.image.version}`;
  if (product.imageUrl) return product.imageUrl;
  return FALLBACK_IMAGE;
}

/** True when nothing but the generic placeholder is available. */
export function hasOwnImage(product: ProductImageSource): boolean {
  return Boolean(product.image ?? product.imageUrl);
}

export const FALLBACK_IMAGE = "/menu/placeholder.svg";
