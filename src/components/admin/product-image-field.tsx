import Image from "next/image";
import type { Locale } from "@/lib/i18n/dictionaries";
import { getDictionary } from "@/lib/i18n/dictionaries";
import {
  deleteProductImageAction,
  uploadProductImageAction,
} from "@/server/admin-actions";
import { productImageUrl } from "@/lib/product-image";
import { Card, Field, Input } from "@/components/ui";
import { TrashIcon } from "@/components/ui/icons";
import { SubmitButton } from "./submit-button";
import { AdminForm } from "./admin-form";

/**
 * Photograph upload for one menu item.
 *
 * Its own form, outside the product form: a multipart upload should not ride
 * along with every price edit, and the owner should be able to change a photo
 * without touching anything else. Also a plain `<form>` with a file input, so
 * it works on the kitchen tablet before hydration.
 */
export function ProductImageField({
  locale,
  product,
}: {
  locale: Locale;
  product: { id: string; slug: string; imageUrl: string | null; image: { version: string } | null };
}) {
  const t = getDictionary(locale);
  const src = productImageUrl(product);
  const hasUpload = Boolean(product.image);

  return (
    <Card className="p-5">
      <h2 className="font-bold text-ink">{t.products.photoTitle}</h2>
      <p className="mb-4 mt-1 text-sm text-ink-muted">{t.products.photoHint}</p>

      <div className="flex flex-wrap items-start gap-5">
        <div className="relative size-32 shrink-0 overflow-hidden rounded-[var(--radius)] border border-line bg-surface-muted">
          <Image
            src={src}
            alt=""
            fill
            sizes="128px"
            className="object-cover"
            // An uploaded photo is served by a route, not a file in /public,
            // and Next cannot statically know its dimensions.
            unoptimized={hasUpload}
          />
        </div>

        <div className="min-w-[16rem] flex-1 space-y-3">
          <AdminForm locale={locale} action={uploadProductImageAction} className="space-y-3">
            <input type="hidden" name="productId" value={product.id} />
            <Field label={t.products.photoFile} htmlFor="product-image" hint={t.products.photoLimits}>
              <Input
                id="product-image"
                name="image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                required
                className="file:me-3 file:rounded-[var(--radius-sm)] file:border-0 file:bg-brand-soft file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-brand"
              />
            </Field>
            <SubmitButton label={t.products.photoUpload} />
          </AdminForm>

          {hasUpload ? (
            <AdminForm locale={locale} action={deleteProductImageAction}>
              <input type="hidden" name="productId" value={product.id} />
              <button
                type="submit"
                className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-sm)] px-3 text-sm font-semibold text-danger hover:bg-danger-soft"
              >
                <TrashIcon />
                {t.products.photoRemove}
              </button>
            </AdminForm>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
