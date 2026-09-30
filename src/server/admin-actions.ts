"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { ForbiddenError } from "@/lib/permissions";
import { diffFields, recordAudit, type AuditAction } from "./audit";
import { restaurantDateToUtc } from "./admin-queries";
import { getRestaurant } from "./restaurant";
import { endOfDateInput, startOfDateInput } from "@/lib/time";
import type { Prisma } from "@prisma/client";

// Catalog, pricing, hours, settings and staff management.
//
// Every export here is a Server Action reachable from the admin UI, and every
// one follows the same three steps: check the permission, validate the input,
// write the audit entry. The point of the product is that a restaurant can run
// itself without a developer (docs/PRD.md §95), which means these actions are
// the ones staff touch most — so they fail loudly and explain themselves
// rather than half-succeeding.

export interface ActionState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

const OK: ActionState = { ok: true };

/** Wraps an action so a thrown domain error becomes a translatable code. */
async function run(fn: () => Promise<ActionState>): Promise<ActionState> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ForbiddenError) return { error: "FORBIDDEN" };
    if (isRedirectError(error)) throw error;
    if (error instanceof z.ZodError) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of error.issues) {
        fieldErrors[issue.path.join(".")] = issue.message;
      }
      return { error: "VALIDATION_ERROR", fieldErrors };
    }
    if (isUniqueConstraintError(error)) return { error: "DUPLICATE" };
    if (isForeignKeyError(error)) return { error: "IN_USE" };
    console.error("[admin-actions] unhandled failure", error);
    return { error: "INTERNAL_ERROR" };
  }
}

// `redirect()` signals by throwing; re-throwing is how it keeps working.
function isRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

function isUniqueConstraintError(error: unknown): boolean {
  return isPrismaError(error, "P2002");
}

function isForeignKeyError(error: unknown): boolean {
  return isPrismaError(error, "P2003") || isPrismaError(error, "P2014");
}

function isPrismaError(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === code
  );
}

async function auditor(permission: Parameters<typeof requirePermission>[0]) {
  const session = await requirePermission(permission);
  return { id: session.userId, name: session.name, role: session.role };
}

async function audit(
  actor: { id: string; name: string },
  action: AuditAction,
  entity: string,
  entityId: string | null,
  metadata?: Prisma.InputJsonValue
) {
  await recordAudit({ actor, action, entity, entityId, metadata });
}

function revalidateAdmin(...paths: string[]) {
  for (const path of paths) revalidatePath(path);
  // Catalog and settings changes are visible to customers immediately.
  revalidatePath("/", "layout");
}

/* -------------------------------------------------------------------------- */
/* Shared field shapes                                                        */
/* -------------------------------------------------------------------------- */

const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(60)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug_format");

const moneySchema = z.coerce.number().int().min(0).max(100_000_000);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : null));

function text(form: FormData, key: string): string {
  return String(form.get(key) ?? "");
}
function checkbox(form: FormData, key: string): boolean {
  return form.get(key) === "on" || form.get(key) === "true";
}

/* -------------------------------------------------------------------------- */
/* Categories                                                                 */
/* -------------------------------------------------------------------------- */

const categorySchema = z.object({
  slug: slugSchema,
  nameAr: z.string().trim().min(1).max(80),
  nameEn: z.string().trim().min(1).max(80),
  descriptionAr: optionalText(300),
  descriptionEn: optionalText(300),
  icon: optionalText(30),
  sortOrder: z.coerce.number().int().min(0).max(999),
  active: z.boolean(),
});

export async function saveCategoryAction(form: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await auditor("categories.manage");
    const id = text(form, "id");
    const data = categorySchema.parse({
      slug: text(form, "slug"),
      nameAr: text(form, "nameAr"),
      nameEn: text(form, "nameEn"),
      descriptionAr: text(form, "descriptionAr"),
      descriptionEn: text(form, "descriptionEn"),
      icon: text(form, "icon"),
      sortOrder: text(form, "sortOrder") || 0,
      active: checkbox(form, "active"),
    });

    if (id) {
      const before = await prisma.category.findUniqueOrThrow({ where: { id } });
      await prisma.category.update({ where: { id }, data });
      await audit(actor, "category.update", "Category", id, diffFields(before, data));
    } else {
      const created = await prisma.category.create({ data });
      await audit(actor, "category.create", "Category", created.id, { slug: created.slug });
    }

    revalidateAdmin("/admin/categories", "/menu");
    return OK;
  });
}

export async function deleteCategoryAction(form: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await auditor("categories.manage");
    const id = text(form, "id");
    const productCount = await prisma.product.count({ where: { categoryId: id } });
    if (productCount > 0) return { error: "CATEGORY_HAS_PRODUCTS" };

    await prisma.category.delete({ where: { id } });
    await audit(actor, "category.delete", "Category", id);
    revalidateAdmin("/admin/categories", "/menu");
    return OK;
  });
}

/* -------------------------------------------------------------------------- */
/* Products                                                                   */
/* -------------------------------------------------------------------------- */

const productSchema = z.object({
  slug: slugSchema,
  categoryId: z.string().min(1),
  nameAr: z.string().trim().min(1).max(120),
  nameEn: z.string().trim().min(1).max(120),
  descriptionAr: optionalText(400),
  descriptionEn: optionalText(400),
  imageUrl: optionalText(300),
  basePriceMinor: moneySchema,
  availability: z.enum(["AVAILABLE", "SOLD_OUT", "HIDDEN"]),
  featured: z.boolean(),
  badge: optionalText(30),
  sortOrder: z.coerce.number().int().min(0).max(999),
  prepMinutes: z
    .union([z.literal(""), z.coerce.number().int().min(1).max(240)])
    .transform((value) => (value === "" ? null : value)),
});

export async function saveProductAction(form: FormData): Promise<ActionState> {
  return run(async () => {
    const id = text(form, "id");
    const actor = await auditor(id ? "products.update" : "products.create");
    const data = productSchema.parse({
      slug: text(form, "slug"),
      categoryId: text(form, "categoryId"),
      nameAr: text(form, "nameAr"),
      nameEn: text(form, "nameEn"),
      descriptionAr: text(form, "descriptionAr"),
      descriptionEn: text(form, "descriptionEn"),
      imageUrl: text(form, "imageUrl"),
      basePriceMinor: text(form, "basePriceMinor") || 0,
      availability: text(form, "availability") || "AVAILABLE",
      featured: checkbox(form, "featured"),
      badge: text(form, "badge"),
      sortOrder: text(form, "sortOrder") || 0,
      prepMinutes: text(form, "prepMinutes"),
    });

    let productId = id;
    if (id) {
      const before = await prisma.product.findUniqueOrThrow({ where: { id } });
      await prisma.product.update({ where: { id }, data });
      const changes = diffFields(before, data);
      await audit(actor, "product.update", "Product", id, changes);
      // A price change is the single most consequential catalog edit, so it
      // also gets its own searchable entry.
      if ("basePriceMinor" in changes) {
        await audit(actor, "product.update", "Product", id, {
          priceChange: changes.basePriceMinor,
        });
      }
    } else {
      const created = await prisma.product.create({ data });
      productId = created.id;
      await audit(actor, "product.create", "Product", created.id, { slug: created.slug });
    }

    revalidateAdmin("/admin/products", "/menu");
    redirect(`/admin/products/${productId}`);
  });
}

export async function setProductAvailabilityAction(form: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await auditor("products.update");
    const id = text(form, "id");
    const availability = z.enum(["AVAILABLE", "SOLD_OUT", "HIDDEN"]).parse(text(form, "availability"));
    await prisma.product.update({ where: { id }, data: { availability } });
    await audit(actor, "product.availability", "Product", id, { availability });
    revalidateAdmin("/admin/products", "/menu");
    return OK;
  });
}

export async function deleteProductAction(form: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await auditor("products.delete");
    const id = text(form, "id");

    // Historical orders keep a snapshot of name and price, but deleting a
    // product that appears in one would still null its link and lose the
    // thread back to the catalog. Hiding is the correct move, and the UI says
    // so (docs/PRD.md §32, §44).
    const usedInOrders = await prisma.orderItem.count({ where: { productId: id } });
    if (usedInOrders > 0) return { error: "PRODUCT_IN_USE" };

    await prisma.product.delete({ where: { id } });
    await audit(actor, "product.delete", "Product", id);
    revalidateAdmin("/admin/products", "/menu");
    redirect("/admin/products");
  });
}

/* -------------------------------------------------------------------------- */
/* Product options                                                            */
/* -------------------------------------------------------------------------- */

export async function saveOptionGroupAction(form: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await auditor("addons.manage");
    const id = text(form, "id");
    const productId = text(form, "productId");
    const data = {
      nameAr: z.string().trim().min(1).max(80).parse(text(form, "nameAr")),
      nameEn: z.string().trim().min(1).max(80).parse(text(form, "nameEn")),
      required: checkbox(form, "required"),
      multiSelect: checkbox(form, "multiSelect"),
      maxSelect: text(form, "maxSelect")
        ? z.coerce.number().int().min(1).max(20).parse(text(form, "maxSelect"))
        : null,
      sortOrder: z.coerce.number().int().min(0).max(999).parse(text(form, "sortOrder") || 0),
    };

    if (id) {
      await prisma.productOptionGroup.update({ where: { id }, data });
    } else {
      await prisma.productOptionGroup.create({ data: { ...data, productId } });
    }
    await audit(actor, "product.update", "ProductOptionGroup", id || productId, data);
    revalidateAdmin(`/admin/products/${productId}`, "/menu");
    return OK;
  });
}

export async function deleteOptionGroupAction(form: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await auditor("addons.manage");
    const id = text(form, "id");
    const productId = text(form, "productId");
    await prisma.productOptionGroup.delete({ where: { id } });
    await audit(actor, "product.update", "ProductOptionGroup", id, { deleted: true });
    revalidateAdmin(`/admin/products/${productId}`, "/menu");
    return OK;
  });
}

export async function saveOptionValueAction(form: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await auditor("addons.manage");
    const id = text(form, "id");
    const groupId = text(form, "groupId");
    const productId = text(form, "productId");
    const data = {
      nameAr: z.string().trim().min(1).max(80).parse(text(form, "nameAr")),
      nameEn: z.string().trim().min(1).max(80).parse(text(form, "nameEn")),
      priceDeltaMinor: z.coerce
        .number()
        .int()
        .min(-100_000_000)
        .max(100_000_000)
        .parse(text(form, "priceDeltaMinor") || 0),
      available: checkbox(form, "available"),
      sortOrder: z.coerce.number().int().min(0).max(999).parse(text(form, "sortOrder") || 0),
    };

    if (id) {
      await prisma.productOptionValue.update({ where: { id }, data });
    } else {
      await prisma.productOptionValue.create({ data: { ...data, groupId } });
    }
    await audit(actor, "product.update", "ProductOptionValue", id || groupId, data);
    revalidateAdmin(`/admin/products/${productId}`, "/menu");
    return OK;
  });
}

export async function deleteOptionValueAction(form: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await auditor("addons.manage");
    const id = text(form, "id");
    const productId = text(form, "productId");

    // An option value referenced by a past order is set to null rather than
    // deleted (schema `onDelete: SetNull`), and the order keeps its snapshot —
    // so this is safe, unlike deleting the product itself.
    await prisma.productOptionValue.delete({ where: { id } });
    await audit(actor, "product.update", "ProductOptionValue", id, { deleted: true });
    revalidateAdmin(`/admin/products/${productId}`, "/menu");
    return OK;
  });
}

/* -------------------------------------------------------------------------- */
/* Promotions                                                                 */
/* -------------------------------------------------------------------------- */

const promotionSchema = z.object({
  code: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((value) => (value ? value.toUpperCase() : null)),
  nameAr: z.string().trim().min(1).max(120),
  nameEn: z.string().trim().min(1).max(120),
  descriptionAr: optionalText(300),
  descriptionEn: optionalText(300),
  discountType: z.enum(["PERCENTAGE", "FIXED"]),
  discountValue: z.coerce.number().int().min(1).max(100_000_000),
  minOrderMinor: moneySchema,
  maxDiscountMinor: z
    .union([z.literal(""), moneySchema])
    .transform((value) => (value === "" ? null : value)),
  // Kept as the raw "YYYY-MM-DD" the date input produces. `z.coerce.date()`
  // would read it as midnight UTC, which is a different day from the one the
  // owner picked — see the window computed in the action below.
  startsAt: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
  endsAt: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
  usageLimit: z
    .union([z.literal(""), z.coerce.number().int().min(1).max(1_000_000)])
    .transform((value) => (value === "" ? null : value)),
  active: z.boolean(),
});

export async function savePromotionAction(form: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await auditor("promotions.manage");
    const id = text(form, "id");
    const parsed = promotionSchema.parse({
      code: text(form, "code"),
      nameAr: text(form, "nameAr"),
      nameEn: text(form, "nameEn"),
      descriptionAr: text(form, "descriptionAr"),
      descriptionEn: text(form, "descriptionEn"),
      discountType: text(form, "discountType") || "PERCENTAGE",
      discountValue: text(form, "discountValue") || 1,
      minOrderMinor: text(form, "minOrderMinor") || 0,
      maxDiscountMinor: text(form, "maxDiscountMinor"),
      startsAt: text(form, "startsAt"),
      endsAt: text(form, "endsAt"),
      usageLimit: text(form, "usageLimit"),
      active: checkbox(form, "active"),
    });

    // A percentage above 100 would hand money back; the schema can't express
    // "depends on another field", so it's checked here.
    if (parsed.discountType === "PERCENTAGE" && parsed.discountValue > 100) {
      return { error: "VALIDATION_ERROR", fieldErrors: { discountValue: "max_100" } };
    }
    if (parsed.startsAt && parsed.endsAt && parsed.endsAt < parsed.startsAt) {
      return { error: "VALIDATION_ERROR", fieldErrors: { endsAt: "before_start" } };
    }

    // A calendar date only means something inside a timezone, and the one
    // that matters is the restaurant's. "Starts on the 5th" is that day's
    // first minute there; "ends on the 5th" is its last, because an offer
    // advertised until a date is good through that date.
    const { timezone } = await getRestaurant();
    const data = {
      ...parsed,
      startsAt: parsed.startsAt ? startOfDateInput(parsed.startsAt, timezone) : null,
      endsAt: parsed.endsAt ? endOfDateInput(parsed.endsAt, timezone) : null,
    };

    const productIds = form.getAll("productIds").map(String).filter(Boolean);

    const promotion = id
      ? await prisma.promotion.update({ where: { id }, data })
      : await prisma.promotion.create({ data });

    // Scope is replaced wholesale — simpler to reason about than diffing, and
    // the set is small.
    await prisma.promotionProduct.deleteMany({ where: { promotionId: promotion.id } });
    if (productIds.length > 0) {
      await prisma.promotionProduct.createMany({
        data: productIds.map((productId) => ({ promotionId: promotion.id, productId })),
        skipDuplicates: true,
      });
    }

    await audit(actor, id ? "promotion.update" : "promotion.create", "Promotion", promotion.id, {
      code: promotion.code,
      discountType: promotion.discountType,
      discountValue: promotion.discountValue,
      scopedProducts: productIds.length,
    });
    revalidateAdmin("/admin/promotions", "/");
    return OK;
  });
}

export async function deletePromotionAction(form: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await auditor("promotions.manage");
    const id = text(form, "id");
    // Orders reference the promotion with onDelete: SetNull, so history keeps
    // its promoCode snapshot.
    await prisma.promotion.delete({ where: { id } });
    await audit(actor, "promotion.delete", "Promotion", id);
    revalidateAdmin("/admin/promotions", "/");
    return OK;
  });
}

/* -------------------------------------------------------------------------- */
/* Business hours                                                             */
/* -------------------------------------------------------------------------- */

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "time_format");

export async function saveBusinessHoursAction(form: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await auditor("hours.manage");
    const restaurant = await prisma.restaurant.findFirstOrThrow({ select: { id: true } });

    const updates = [];
    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
      const closed = checkbox(form, `closed-${dayOfWeek}`);
      const opensAt = hhmm.parse(text(form, `opensAt-${dayOfWeek}`) || "16:00");
      const closesAt = hhmm.parse(text(form, `closesAt-${dayOfWeek}`) || "00:00");
      updates.push(
        prisma.businessHour.upsert({
          where: { restaurantId_dayOfWeek: { restaurantId: restaurant.id, dayOfWeek } },
          create: { restaurantId: restaurant.id, dayOfWeek, opensAt, closesAt, closed },
          update: { opensAt, closesAt, closed },
        })
      );
    }
    await prisma.$transaction(updates);

    await audit(actor, "hours.update", "Restaurant", restaurant.id);
    revalidateAdmin("/admin/hours", "/");
    return OK;
  });
}

export async function addScheduleOverrideAction(form: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await auditor("hours.manage");
    const restaurant = await prisma.restaurant.findFirstOrThrow({ select: { id: true } });

    const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(text(form, "date"));
    const closed = checkbox(form, "closed");
    const date = await restaurantDateToUtc(dateOnly);

    await prisma.scheduleOverride.upsert({
      where: { restaurantId_date: { restaurantId: restaurant.id, date } },
      create: {
        restaurantId: restaurant.id,
        date,
        closed,
        opensAt: closed ? null : hhmm.parse(text(form, "opensAt") || "16:00"),
        closesAt: closed ? null : hhmm.parse(text(form, "closesAt") || "00:00"),
        reasonAr: text(form, "reasonAr") || null,
        reasonEn: text(form, "reasonEn") || null,
      },
      update: {
        closed,
        opensAt: closed ? null : hhmm.parse(text(form, "opensAt") || "16:00"),
        closesAt: closed ? null : hhmm.parse(text(form, "closesAt") || "00:00"),
        reasonAr: text(form, "reasonAr") || null,
        reasonEn: text(form, "reasonEn") || null,
      },
    });

    await audit(actor, "hours.override.create", "ScheduleOverride", null, { date: dateOnly, closed });
    revalidateAdmin("/admin/hours", "/");
    return OK;
  });
}

export async function deleteScheduleOverrideAction(form: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await auditor("hours.manage");
    const id = text(form, "id");
    await prisma.scheduleOverride.delete({ where: { id } });
    await audit(actor, "hours.override.delete", "ScheduleOverride", id);
    revalidateAdmin("/admin/hours", "/");
    return OK;
  });
}

/* -------------------------------------------------------------------------- */
/* Restaurant settings                                                        */
/* -------------------------------------------------------------------------- */

const settingsSchema = z.object({
  name: z.string().trim().min(1).max(120),
  nameAr: z.string().trim().min(1).max(120),
  taglineAr: optionalText(160),
  taglineEn: optionalText(160),
  aboutAr: optionalText(1200),
  aboutEn: optionalText(1200),
  currency: z.string().trim().length(3).toUpperCase(),
  timezone: z.string().trim().min(3).max(64),
  phone: optionalText(40),
  whatsapp: optionalText(40),
  email: optionalText(120),
  addressAr: optionalText(200),
  addressEn: optionalText(200),
  city: optionalText(80),
  mapUrl: optionalText(400),
  instagramUrl: optionalText(200),
  facebookUrl: optionalText(200),
  defaultPrepMinutes: z.coerce.number().int().min(1).max(240),
  slotIntervalMinutes: z.coerce.number().int().min(5).max(120),
  slotCapacity: z.coerce.number().int().min(1).max(500),
  maxScheduleDaysAhead: z.coerce.number().int().min(0).max(30),
  minOrderMinor: moneySchema,
  pauseMessageAr: optionalText(300),
  pauseMessageEn: optionalText(300),
  bankNameAr: optionalText(120),
  bankNameEn: optionalText(120),
  bankAccount: optionalText(80),
  bankHolderAr: optionalText(120),
  bankHolderEn: optionalText(120),
  seoTitleAr: optionalText(160),
  seoTitleEn: optionalText(160),
  seoDescriptionAr: optionalText(320),
  seoDescriptionEn: optionalText(320),
});

export async function saveSettingsAction(form: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await auditor("settings.update");
    const restaurant = await prisma.restaurant.findFirstOrThrow();

    const raw = Object.fromEntries(
      Object.keys(settingsSchema.shape).map((key) => [key, text(form, key)])
    );
    const data = settingsSchema.parse(raw);

    // An invalid IANA zone would silently break every pickup slot, so it is
    // verified against the platform's own database before being stored.
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: data.timezone });
    } catch {
      return { error: "VALIDATION_ERROR", fieldErrors: { timezone: "invalid_timezone" } };
    }

    await prisma.restaurant.update({ where: { id: restaurant.id }, data });
    await audit(actor, "settings.update", "Restaurant", restaurant.id, diffFields(restaurant, data));
    revalidateAdmin("/admin/settings", "/");
    return OK;
  });
}

export async function savePaymentMethodAction(form: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await auditor("settings.update");
    const id = text(form, "id");
    const data = {
      enabled: checkbox(form, "enabled"),
      instructionsAr: text(form, "instructionsAr") || null,
      instructionsEn: text(form, "instructionsEn") || null,
    };
    await prisma.paymentMethodConfig.update({ where: { id }, data });
    await audit(actor, "payment-method.update", "PaymentMethodConfig", id, data);
    revalidateAdmin("/admin/settings", "/checkout");
    return OK;
  });
}

/* -------------------------------------------------------------------------- */
/* Staff                                                                      */
/* -------------------------------------------------------------------------- */

const staffSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(160),
  role: z.enum(["OWNER", "MANAGER", "CASHIER", "KITCHEN"]),
  active: z.boolean(),
});

export async function saveStaffAction(form: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await auditor("staff.manage");
    const id = text(form, "id");
    const password = text(form, "password");
    const data = staffSchema.parse({
      name: text(form, "name"),
      email: text(form, "email"),
      role: text(form, "role") || "KITCHEN",
      active: checkbox(form, "active"),
    });

    if (!id && password.length < 8) {
      return { error: "VALIDATION_ERROR", fieldErrors: { password: "too_short" } };
    }
    if (id && password && password.length < 8) {
      return { error: "VALIDATION_ERROR", fieldErrors: { password: "too_short" } };
    }

    if (id) {
      // Never leave the restaurant without a way in: the last active owner
      // can't be demoted or deactivated, including by themselves.
      const wouldRemoveLastOwner =
        (data.role !== "OWNER" || !data.active) &&
        (await isLastActiveOwner(id));
      if (wouldRemoveLastOwner) return { error: "LAST_OWNER" };

      await prisma.user.update({
        where: { id },
        data: {
          ...data,
          ...(password ? { passwordHash: await bcrypt.hash(password, 12) } : {}),
        },
      });
      await audit(actor, "staff.update", "User", id, {
        ...data,
        passwordChanged: Boolean(password),
      });
    } else {
      const created = await prisma.user.create({
        data: { ...data, passwordHash: await bcrypt.hash(password, 12) },
      });
      await audit(actor, "staff.create", "User", created.id, { email: created.email, role: created.role });
    }

    revalidateAdmin("/admin/staff");
    return OK;
  });
}

export async function deleteStaffAction(form: FormData): Promise<ActionState> {
  return run(async () => {
    const session = await requirePermission("staff.manage");
    const actor = { id: session.userId, name: session.name };
    const id = text(form, "id");

    if (id === session.userId) return { error: "CANNOT_DELETE_SELF" };
    if (await isLastActiveOwner(id)) return { error: "LAST_OWNER" };

    await prisma.user.delete({ where: { id } });
    await audit(actor, "staff.delete", "User", id);
    revalidateAdmin("/admin/staff");
    return OK;
  });
}

async function isLastActiveOwner(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, active: true } });
  if (!user || user.role !== "OWNER" || !user.active) return false;
  const otherOwners = await prisma.user.count({
    where: { role: "OWNER", active: true, id: { not: userId } },
  });
  return otherOwners === 0;
}
