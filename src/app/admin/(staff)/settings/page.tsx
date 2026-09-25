import { requirePagePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getRestaurant } from "@/server/restaurant";
import { savePaymentMethodAction, saveSettingsAction } from "@/server/admin-actions";
import { Alert, Card, Checkbox, Field, Input, SectionHeading, Textarea } from "@/components/ui";
import { InfoIcon } from "@/components/ui/icons";
import { SubmitButton } from "@/components/admin/submit-button";
import { AdminForm } from "@/components/admin/admin-form";

export const dynamic = "force-dynamic";

/**
 * Restaurant configuration.
 *
 * Everything the product treats as restaurant-specific lives on one row and
 * is edited here — branding, contact details, ordering rules, payment
 * instructions, SEO copy. That is the architectural commitment from
 * docs/PRD.md §89 made visible: nothing on this page exists in code.
 */
export default async function AdminSettingsPage() {
  const session = await requirePagePermission("settings.read");
  const locale = await getLocale();
  const t = getDictionary(locale);
  const restaurant = await getRestaurant();
  const readOnly = !can(session.role, "settings.update");

  return (
    <div className="space-y-6">
      <SectionHeading level={1} title={t.settings.title} />

      {readOnly ? (
        <Alert tone="info" icon={<InfoIcon />}>
          {t.admin.noPermission}
        </Alert>
      ) : null}

      <AdminForm locale={locale} action={saveSettingsAction} className="space-y-6">
        <fieldset disabled={readOnly} className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-4 font-bold text-ink">{t.settings.identity}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t.settings.restaurantNameAr} htmlFor="nameAr" required>
                <Input id="nameAr" name="nameAr" defaultValue={restaurant.nameAr} required />
              </Field>
              <Field label={t.settings.restaurantNameEn} htmlFor="name" required>
                <Input id="name" name="name" dir="ltr" defaultValue={restaurant.name} required />
              </Field>
              <Field label={t.settings.taglineAr} htmlFor="taglineAr">
                <Input id="taglineAr" name="taglineAr" defaultValue={restaurant.taglineAr ?? ""} />
              </Field>
              <Field label={t.settings.taglineEn} htmlFor="taglineEn">
                <Input id="taglineEn" name="taglineEn" dir="ltr" defaultValue={restaurant.taglineEn ?? ""} />
              </Field>
              <Field label={t.settings.aboutAr} htmlFor="aboutAr" className="sm:col-span-2">
                <Textarea id="aboutAr" name="aboutAr" rows={3} defaultValue={restaurant.aboutAr ?? ""} />
              </Field>
              <Field label={t.settings.aboutEn} htmlFor="aboutEn" className="sm:col-span-2">
                <Textarea id="aboutEn" name="aboutEn" dir="ltr" rows={3} defaultValue={restaurant.aboutEn ?? ""} />
              </Field>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="mb-4 font-bold text-ink">{t.settings.contact}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label={t.settings.phone} htmlFor="phone">
                <Input id="phone" name="phone" dir="ltr" defaultValue={restaurant.phone ?? ""} />
              </Field>
              <Field label={t.settings.whatsapp} htmlFor="whatsapp">
                <Input id="whatsapp" name="whatsapp" dir="ltr" defaultValue={restaurant.whatsapp ?? ""} />
              </Field>
              <Field label={t.settings.email} htmlFor="email">
                <Input id="email" name="email" type="email" dir="ltr" defaultValue={restaurant.email ?? ""} />
              </Field>
              <Field label={t.settings.addressAr} htmlFor="addressAr">
                <Input id="addressAr" name="addressAr" defaultValue={restaurant.addressAr ?? ""} />
              </Field>
              <Field label={t.settings.addressEn} htmlFor="addressEn">
                <Input id="addressEn" name="addressEn" dir="ltr" defaultValue={restaurant.addressEn ?? ""} />
              </Field>
              <Field label={t.settings.city} htmlFor="city">
                <Input id="city" name="city" dir="ltr" defaultValue={restaurant.city ?? ""} />
              </Field>
              <Field label={t.settings.mapUrl} htmlFor="mapUrl">
                <Input id="mapUrl" name="mapUrl" type="url" dir="ltr" defaultValue={restaurant.mapUrl ?? ""} />
              </Field>
              <Field label={t.settings.instagram} htmlFor="instagramUrl">
                <Input id="instagramUrl" name="instagramUrl" type="url" dir="ltr" defaultValue={restaurant.instagramUrl ?? ""} />
              </Field>
              <Field label={t.settings.facebook} htmlFor="facebookUrl">
                <Input id="facebookUrl" name="facebookUrl" type="url" dir="ltr" defaultValue={restaurant.facebookUrl ?? ""} />
              </Field>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="mb-4 font-bold text-ink">{t.settings.ordering}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label={t.settings.currency} htmlFor="currency" required>
                <Input id="currency" name="currency" dir="ltr" maxLength={3} defaultValue={restaurant.currency} required />
              </Field>
              <Field label={t.settings.timezone} htmlFor="timezone" required>
                <Input id="timezone" name="timezone" dir="ltr" defaultValue={restaurant.timezone} required />
              </Field>
              <Field label={t.settings.defaultPrep} htmlFor="defaultPrepMinutes" required>
                <Input
                  id="defaultPrepMinutes"
                  name="defaultPrepMinutes"
                  type="number"
                  dir="ltr"
                  min={1}
                  max={240}
                  defaultValue={restaurant.defaultPrepMinutes}
                  required
                />
              </Field>
              <Field label={t.settings.slotInterval} htmlFor="slotIntervalMinutes" required>
                <Input
                  id="slotIntervalMinutes"
                  name="slotIntervalMinutes"
                  type="number"
                  dir="ltr"
                  min={5}
                  max={120}
                  defaultValue={restaurant.slotIntervalMinutes}
                  required
                />
              </Field>
              <Field label={t.settings.slotCapacity} htmlFor="slotCapacity" required>
                <Input
                  id="slotCapacity"
                  name="slotCapacity"
                  type="number"
                  dir="ltr"
                  min={1}
                  max={500}
                  defaultValue={restaurant.slotCapacity}
                  required
                />
              </Field>
              <Field label={t.settings.maxDaysAhead} htmlFor="maxScheduleDaysAhead" required>
                <Input
                  id="maxScheduleDaysAhead"
                  name="maxScheduleDaysAhead"
                  type="number"
                  dir="ltr"
                  min={0}
                  max={30}
                  defaultValue={restaurant.maxScheduleDaysAhead}
                  required
                />
              </Field>
              <Field label={`${t.settings.minOrder} (${restaurant.currency})`} htmlFor="minOrderMinor">
                <Input
                  id="minOrderMinor"
                  name="minOrderMinor"
                  type="number"
                  dir="ltr"
                  min={0}
                  defaultValue={restaurant.minOrderMinor}
                />
              </Field>
              <Field label={t.settings.pauseMessageAr} htmlFor="pauseMessageAr" className="sm:col-span-2">
                <Textarea id="pauseMessageAr" name="pauseMessageAr" rows={2} defaultValue={restaurant.pauseMessageAr ?? ""} />
              </Field>
              <Field label={t.settings.pauseMessageEn} htmlFor="pauseMessageEn" className="sm:col-span-2">
                <Textarea id="pauseMessageEn" name="pauseMessageEn" dir="ltr" rows={2} defaultValue={restaurant.pauseMessageEn ?? ""} />
              </Field>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="mb-4 font-bold text-ink">{t.settings.bank}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label={`${t.checkout.bankName} (AR)`} htmlFor="bankNameAr">
                <Input id="bankNameAr" name="bankNameAr" defaultValue={restaurant.bankNameAr ?? ""} />
              </Field>
              <Field label={`${t.checkout.bankName} (EN)`} htmlFor="bankNameEn">
                <Input id="bankNameEn" name="bankNameEn" dir="ltr" defaultValue={restaurant.bankNameEn ?? ""} />
              </Field>
              <Field label={t.checkout.bankAccount} htmlFor="bankAccount">
                <Input id="bankAccount" name="bankAccount" dir="ltr" defaultValue={restaurant.bankAccount ?? ""} />
              </Field>
              <Field label={`${t.checkout.bankHolder} (AR)`} htmlFor="bankHolderAr">
                <Input id="bankHolderAr" name="bankHolderAr" defaultValue={restaurant.bankHolderAr ?? ""} />
              </Field>
              <Field label={`${t.checkout.bankHolder} (EN)`} htmlFor="bankHolderEn">
                <Input id="bankHolderEn" name="bankHolderEn" dir="ltr" defaultValue={restaurant.bankHolderEn ?? ""} />
              </Field>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="mb-4 font-bold text-ink">{t.settings.seo}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={`${t.settings.seo} — AR`} htmlFor="seoTitleAr">
                <Input id="seoTitleAr" name="seoTitleAr" defaultValue={restaurant.seoTitleAr ?? ""} maxLength={160} />
              </Field>
              <Field label={`${t.settings.seo} — EN`} htmlFor="seoTitleEn">
                <Input id="seoTitleEn" name="seoTitleEn" dir="ltr" defaultValue={restaurant.seoTitleEn ?? ""} maxLength={160} />
              </Field>
              <Field label="Meta description (AR)" htmlFor="seoDescriptionAr">
                <Textarea id="seoDescriptionAr" name="seoDescriptionAr" rows={2} defaultValue={restaurant.seoDescriptionAr ?? ""} maxLength={320} />
              </Field>
              <Field label="Meta description (EN)" htmlFor="seoDescriptionEn">
                <Textarea id="seoDescriptionEn" name="seoDescriptionEn" dir="ltr" rows={2} defaultValue={restaurant.seoDescriptionEn ?? ""} maxLength={320} />
              </Field>
            </div>
          </Card>

          <SubmitButton label={t.common.save} />
        </fieldset>
      </AdminForm>

      <section>
        <SectionHeading title={t.settings.paymentMethods} />
        <ul className="space-y-3">
          {restaurant.paymentMethods.map((method) => (
            <Card as="li" key={method.id} className="p-5">
              <AdminForm locale={locale} action={savePaymentMethodAction} className="grid gap-3 lg:grid-cols-4 lg:items-end">
                <input type="hidden" name="id" value={method.id} />
                <p className="font-bold text-ink lg:pb-3">{t.paymentMethod[method.type]}</p>
                <Field label={t.settings.instructionsAr} htmlFor={`ia-${method.id}`}>
                  <Input id={`ia-${method.id}`} name="instructionsAr" defaultValue={method.instructionsAr ?? ""} />
                </Field>
                <Field label={t.settings.instructionsEn} htmlFor={`ie-${method.id}`}>
                  <Input id={`ie-${method.id}`} name="instructionsEn" dir="ltr" defaultValue={method.instructionsEn ?? ""} />
                </Field>
                <div className="flex items-center gap-3 pb-1">
                  <Checkbox name="enabled" label={t.settings.enabled} defaultChecked={method.enabled} />
                  <SubmitButton label={t.common.save} variant="secondary" />
                </div>
              </AdminForm>
            </Card>
          ))}
        </ul>
      </section>
    </div>
  );
}
