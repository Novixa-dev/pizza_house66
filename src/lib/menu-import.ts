// Menu import: parse a CSV, and work out what importing it would change.
//
// This is pure on purpose — no database, no file system. The restaurant's real
// menu is on the order of 180 items, which is days of work to enter through the
// admin screens one at a time, and an import that writes prices customers will
// be charged is exactly the kind of code that has to be tested without a
// database in the loop. The script in scripts/import-menu.ts does the I/O; this
// does the thinking.
//
// Principles the rest of the file follows:
//
//  - Nothing is deleted. A product missing from the file is left alone, because
//    "not in this file" and "should not exist" are different statements.
//  - A blank cell means "leave unchanged", never "clear it". Otherwise a file
//    carrying only names and prices would silently wipe every description.
//  - New products arrive HIDDEN unless asked otherwise. An import should never
//    be the moment unreviewed prices go in front of customers.
//  - Anything wrong stops the whole import. Half a menu is worse than none.

import { createHash } from "node:crypto";
import { toMinorUnits } from "./money";

export const IMPORT_MAX_ROWS = 1000;
export const PRICE_MAX_MAJOR = 1_000_000;

export type ImportStatus = "AVAILABLE" | "SOLD_OUT" | "HIDDEN";
const STATUSES: ImportStatus[] = ["AVAILABLE", "SOLD_OUT", "HIDDEN"];

export interface MenuRow {
  /** 1-based line in the file, header included, for error messages. */
  line: number;
  category: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  /** True when `nameEn` was not supplied and has been filled from `nameAr`. */
  nameEnMissing: boolean;
  descriptionAr: string | null;
  descriptionEn: string | null;
  priceMinor: number;
  status: ImportStatus | null;
  prepMinutes: number | null;
  featured: boolean | null;
}

export interface ImportIssue {
  line: number;
  message: string;
}

export interface ParsedMenu {
  rows: MenuRow[];
  errors: ImportIssue[];
  warnings: ImportIssue[];
}

// --------------------------------------------------------------------------
// CSV
// --------------------------------------------------------------------------

/**
 * A small RFC 4180 reader: quoted fields, doubled quotes, newlines inside
 * quotes, CRLF, and a byte-order mark. Written out rather than imported
 * because the format is tiny and the dependency would be the project's only
 * one for it.
 *
 * Excel in some regional settings writes `;` instead of `,`, so the delimiter
 * is detected from the header line.
 */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const firstLine = text.split(/\r\n|\n|\r/, 1)[0] ?? "";
  const delimiter = firstLine.includes(";") && !firstLine.includes(",") ? ";" : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]!;

    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// --------------------------------------------------------------------------
// Columns
// --------------------------------------------------------------------------

const COLUMN_ALIASES: Record<string, string> = {
  category: "category",
  القسم: "category",
  التصنيف: "category",
  name_ar: "name_ar",
  الاسم: "name_ar",
  name_en: "name_en",
  price: "price",
  السعر: "price",
  description_ar: "description_ar",
  الوصف: "description_ar",
  description_en: "description_en",
  slug: "slug",
  status: "status",
  الحالة: "status",
  prep_minutes: "prep_minutes",
  featured: "featured",
};

const REQUIRED_COLUMNS = ["category", "name_ar", "price"] as const;

function normalizeHeader(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "_");
}

// --------------------------------------------------------------------------
// Values
// --------------------------------------------------------------------------

const EASTERN_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

/**
 * Arabic-Indic and Persian digits to ASCII, and separators read for what they
 * are.
 *
 * A comma is a thousands separator only when it groups digits in threes:
 * "4,500" is 4500. Anywhere else it is a decimal comma, as European-locale
 * spreadsheets write it: "45,5" is 45.5 — which a price in whole rials then
 * rejects as fractional. The earlier version stripped every comma, so "45,5"
 * silently became 455: a tenfold price on a menu, with no error anywhere.
 */
export function normalizeNumber(raw: string): string {
  let out = "";
  for (const char of raw) {
    const eastern = EASTERN_DIGITS.indexOf(char);
    const persian = PERSIAN_DIGITS.indexOf(char);
    if (eastern !== -1) out += String(eastern);
    else if (persian !== -1) out += String(persian);
    else if (char === "٫") out += "."; // Arabic decimal separator
    else if (/\s/.test(char) || char === "'" || char === "\u2019") continue; // spaces and apostrophe grouping
    else out += char;
  }

  // Grouping: one to three digits, then groups of exactly three.
  if (/^\d{1,3}([,٬،]\d{3})+(\.\d+)?$/.test(out)) return out.replace(/[,٬،]/g, "");

  // Anything else: a comma is a decimal mark, and the Arabic thousands mark is noise.
  return out.replace(/[,،]/g, ".").replace(/٬/g, "");
}

/** Collapses whitespace so a double space in a spreadsheet cell does not make a duplicate category. */
export function normalizeName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

function shortHash(value: string): string {
  return createHash("sha1").update(value, "utf8").digest("hex").slice(0, 8);
}

/**
 * A slug that is stable across imports of the same item.
 *
 * Arabic names have no good ASCII transliteration, so unless the file supplies
 * a slug the product gets `m-<hash of category and name>`. Re-importing the
 * same row therefore updates the same product instead of creating a twin.
 * The cost is an unreadable URL; a `slug` column avoids it.
 */
export function generateSlug(category: string, nameAr: string): string {
  return `m-${shortHash(`${normalizeName(category)}|${normalizeName(nameAr)}`)}`;
}

export function generateCategorySlug(nameAr: string): string {
  return `c-${shortHash(normalizeName(nameAr))}`;
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function parseBoolean(raw: string): boolean | null {
  const value = raw.trim().toLowerCase();
  if (["true", "1", "yes", "y", "نعم"].includes(value)) return true;
  if (["false", "0", "no", "n", "لا"].includes(value)) return false;
  return null;
}

// --------------------------------------------------------------------------
// Parse
// --------------------------------------------------------------------------

export function parseMenuCsv(input: string, currency = "YER"): ParsedMenu {
  const errors: ImportIssue[] = [];
  const warnings: ImportIssue[] = [];
  const rows: MenuRow[] = [];

  // The replacement character means the file was not UTF-8. Arabic Excel's
  // plain "CSV (Comma delimited)" saves in Windows-1256, not UTF-8, so every
  // Arabic letter arrives as a byte that is not valid UTF-8 and is decoded to
  // U+FFFD. Without this check the import would succeed and write a menu of
  // question marks. Refuse, and say how to save it properly.
  if (input.includes("\uFFFD")) {
    errors.push({
      line: 1,
      message:
        'The file is not UTF-8 — its Arabic text has been garbled. In Excel use "Save As" ▸ "CSV UTF-8 (Comma delimited)", not plain "CSV".',
    });
    return { rows, errors, warnings };
  }

  const table = parseCsv(input);
  if (table.length === 0) {
    errors.push({ line: 1, message: "The file is empty." });
    return { rows, errors, warnings };
  }

  // Header: map each column to its canonical name; unknown ones are reported
  // rather than ignored, because a misspelt "pirce" would otherwise vanish and
  // surface as a baffling "price is required" on every row.
  const headerCells = table[0]!.map(normalizeHeader);
  const columnIndex = new Map<string, number>();
  headerCells.forEach((cell, index) => {
    if (cell === "") return;
    const canonical = COLUMN_ALIASES[cell];
    if (!canonical) {
      warnings.push({ line: 1, message: `Unknown column "${table[0]![index]!.trim()}" — ignored.` });
      return;
    }
    if (columnIndex.has(canonical)) {
      warnings.push({ line: 1, message: `Column "${canonical}" appears twice — the first one is used.` });
      return;
    }
    columnIndex.set(canonical, index);
  });

  const missing = REQUIRED_COLUMNS.filter((column) => !columnIndex.has(column));
  if (missing.length > 0) {
    errors.push({ line: 1, message: `Missing required column(s): ${missing.join(", ")}.` });
    return { rows, errors, warnings };
  }

  const cell = (record: string[], column: string): string =>
    (columnIndex.has(column) ? record[columnIndex.get(column)!] ?? "" : "").trim();

  const dataRows = table.slice(1).map((record, offset) => ({ record, line: offset + 2 }));
  const nonEmpty = dataRows.filter(({ record }) => record.some((value) => value.trim() !== ""));

  if (nonEmpty.length > IMPORT_MAX_ROWS) {
    errors.push({
      line: 1,
      message: `${nonEmpty.length} rows is more than the ${IMPORT_MAX_ROWS} an import accepts. Split the file.`,
    });
    return { rows, errors, warnings };
  }

  const seenSlugs = new Map<string, number>();
  const seenNames = new Map<string, number>();

  for (const { record, line } of nonEmpty) {
    const before = errors.length;
    const fail = (message: string) => errors.push({ line, message });

    const category = normalizeName(cell(record, "category"));
    const nameAr = normalizeName(cell(record, "name_ar"));
    if (!category) fail("category is required.");
    if (!nameAr) fail("name_ar is required.");
    if (nameAr.length > 120) fail("name_ar is longer than 120 characters.");

    // Price: the whole-unit figure a person types, converted once, here.
    const priceRaw = normalizeNumber(cell(record, "price"));
    let priceMinor = 0;
    if (priceRaw === "") {
      fail("price is required.");
    } else if (!/^\d+(\.\d+)?$/.test(priceRaw)) {
      fail(`price "${cell(record, "price")}" is not a number.`);
    } else {
      const major = Number(priceRaw);
      priceMinor = toMinorUnits(major, currency);
      if (currency === "YER" && !Number.isInteger(major)) {
        fail(`price ${priceRaw} has a fractional part; the rial has no subunit in use. Write whole rials with no decimal point (1700, not 1.700 or 1,7).`);
      } else if (major <= 0) {
        fail("price must be greater than zero.");
      } else if (major > PRICE_MAX_MAJOR) {
        fail(`price ${major} is above ${PRICE_MAX_MAJOR}; check for an extra digit.`);
      }
    }

    // Slug.
    const slugRaw = cell(record, "slug");
    let slug: string;
    if (slugRaw) {
      slug = slugRaw.toLowerCase();
      if (!SLUG_PATTERN.test(slug) || slug.length > 80) {
        fail(`slug "${slugRaw}" must be lowercase letters, digits and hyphens, up to 80 characters.`);
      }
    } else {
      slug = generateSlug(category, nameAr);
    }

    // Status.
    const statusRaw = cell(record, "status").toUpperCase();
    let status: ImportStatus | null = null;
    if (statusRaw) {
      if ((STATUSES as string[]).includes(statusRaw)) status = statusRaw as ImportStatus;
      else fail(`status "${cell(record, "status")}" must be one of ${STATUSES.join(", ")}.`);
    }

    // Prep time.
    const prepRaw = normalizeNumber(cell(record, "prep_minutes"));
    let prepMinutes: number | null = null;
    if (prepRaw) {
      const prep = Number(prepRaw);
      if (!Number.isInteger(prep) || prep < 1 || prep > 180) fail(`prep_minutes "${prepRaw}" must be a whole number from 1 to 180.`);
      else prepMinutes = prep;
    }

    // Featured.
    const featuredRaw = cell(record, "featured");
    let featured: boolean | null = null;
    if (featuredRaw) {
      featured = parseBoolean(featuredRaw);
      if (featured === null) fail(`featured "${featuredRaw}" must be true or false.`);
    }

    const descriptionAr = cell(record, "description_ar") || null;
    const descriptionEn = cell(record, "description_en") || null;
    if (descriptionAr && descriptionAr.length > 600) fail("description_ar is longer than 600 characters.");
    if (descriptionEn && descriptionEn.length > 600) fail("description_en is longer than 600 characters.");

    // Duplicates within the file.
    if (seenSlugs.has(slug)) {
      fail(`duplicates line ${seenSlugs.get(slug)} (same slug "${slug}"). Two rows with the same category and name_ar are the same product.`);
    } else {
      seenSlugs.set(slug, line);
    }

    if (errors.length > before) continue;

    // Two rows with different explicit slugs but the same category and name are
    // almost certainly one product entered twice. Not an error — a restaurant
    // can legitimately sell two things under one name — but worth a line.
    const nameKey = `${category}|${nameAr}`;
    if (seenNames.has(nameKey)) {
      warnings.push({
        line,
        message: `"${nameAr}" in "${category}" has the same name as line ${seenNames.get(nameKey)} but a different slug — two products, or one entered twice?`,
      });
    } else {
      seenNames.set(nameKey, line);
    }

    const nameEnRaw = normalizeName(cell(record, "name_en"));
    const nameEnMissing = nameEnRaw === "";
    if (nameEnMissing) {
      warnings.push({ line, message: `"${nameAr}" has no name_en; the Arabic name will be shown to English visitors.` });
    }

    rows.push({
      line,
      category,
      slug,
      nameAr,
      nameEn: nameEnMissing ? nameAr : nameEnRaw,
      nameEnMissing,
      descriptionAr,
      descriptionEn,
      priceMinor,
      status,
      prepMinutes,
      featured,
    });
  }

  return { rows, errors, warnings };
}

// --------------------------------------------------------------------------
// Plan
// --------------------------------------------------------------------------

export interface ExistingCategory {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
}

export interface ExistingProduct {
  slug: string;
  categoryId: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string | null;
  descriptionEn: string | null;
  basePriceMinor: number;
  availability: ImportStatus;
  prepMinutes: number | null;
  featured: boolean;
}

export interface ProductChange {
  field: string;
  from: string | number | boolean | null;
  to: string | number | boolean | null;
}

/**
 * Where a row's product belongs. Either an existing category, or one of the new
 * categories in the plan, by slug. Decided here, once, so the code that writes
 * to the database never has to re-match names — two copies of that logic is how
 * "Pizza" and "pizza" come to mean different things on either side.
 */
export interface CategoryRef {
  categoryId: string | null;
  newCategorySlug: string | null;
}

export interface ImportPlan {
  newCategories: { slug: string; nameAr: string; nameEn: string }[];
  create: (MenuRow & CategoryRef & { resolvedStatus: ImportStatus })[];
  update: ({ row: MenuRow; changes: ProductChange[] } & CategoryRef)[];
  unchanged: number;
  /** Existing products whose price would change — the line customers feel. */
  priceChanges: { slug: string; nameAr: string; from: number; to: number }[];
}

export interface PlanOptions {
  /** Status for a new product whose row has none. Drafts by default. */
  defaultStatus?: ImportStatus;
}

export function planImport(
  rows: MenuRow[],
  existing: { categories: ExistingCategory[]; products: ExistingProduct[] },
  options: PlanOptions = {}
): ImportPlan {
  const defaultStatus = options.defaultStatus ?? "HIDDEN";

  const categoryByName = new Map<string, ExistingCategory>();
  const categoryBySlug = new Map<string, ExistingCategory>();
  for (const category of existing.categories) {
    categoryByName.set(normalizeName(category.nameAr), category);
    categoryBySlug.set(category.slug, category);
  }
  const productBySlug = new Map(existing.products.map((product) => [product.slug, product]));
  const categoryNameById = new Map(existing.categories.map((category) => [category.id, category.nameAr]));

  const newCategories: ImportPlan["newCategories"] = [];
  const plannedCategoryNames = new Set<string>();
  const create: ImportPlan["create"] = [];
  const update: ImportPlan["update"] = [];
  const priceChanges: ImportPlan["priceChanges"] = [];
  let unchanged = 0;

  for (const row of rows) {
    // A category is matched by Arabic name first, and by slug as a fallback so
    // a file can name `pizza` as readily as `بيتزا` — in any capitalisation,
    // since slugs are lowercase and a spreadsheet will happily capitalise one.
    const category =
      categoryByName.get(row.category) ??
      categoryBySlug.get(row.category) ??
      categoryBySlug.get(row.category.toLowerCase());
    if (!category && !plannedCategoryNames.has(row.category)) {
      plannedCategoryNames.add(row.category);
      newCategories.push({
        slug: generateCategorySlug(row.category),
        nameAr: row.category,
        // No English name is supplied for categories; Arabic stands in, and the
        // owner can translate it from the admin screen.
        nameEn: row.category,
      });
    }
    const ref: CategoryRef = category
      ? { categoryId: category.id, newCategorySlug: null }
      : { categoryId: null, newCategorySlug: generateCategorySlug(row.category) };

    const current = productBySlug.get(row.slug);
    if (!current) {
      create.push({ ...row, ...ref, resolvedStatus: row.status ?? defaultStatus });
      continue;
    }

    const changes: ProductChange[] = [];
    const diff = <T extends ProductChange["from"]>(field: string, from: T, to: T | null | undefined) => {
      // null/undefined in the file means "not provided", never "clear".
      if (to === null || to === undefined) return;
      if (from !== to) changes.push({ field, from, to });
    };

    // A move between categories. Shown by name, because the person reading a
    // dry-run is the owner, not a developer looking at ids. A row naming a
    // category that does not exist yet is a move too — into the one about to be
    // created — and would otherwise be invisible in the plan.
    if (!category) {
      changes.push({ field: "category", from: categoryNameById.get(current.categoryId) ?? current.categoryId, to: row.category });
    } else if (current.categoryId !== category.id) {
      changes.push({ field: "category", from: categoryNameById.get(current.categoryId) ?? current.categoryId, to: category.nameAr });
    }
    diff("nameAr", current.nameAr, row.nameAr);
    // An English name that was only filled in from the Arabic one must not
    // overwrite a real translation already in the database.
    diff("nameEn", current.nameEn, row.nameEnMissing ? null : row.nameEn);
    diff("descriptionAr", current.descriptionAr, row.descriptionAr);
    diff("descriptionEn", current.descriptionEn, row.descriptionEn);
    diff("basePriceMinor", current.basePriceMinor, row.priceMinor);
    diff("prepMinutes", current.prepMinutes, row.prepMinutes);
    diff("featured", current.featured, row.featured);
    diff("availability", current.availability, row.status);

    if (current.basePriceMinor !== row.priceMinor) {
      priceChanges.push({ slug: row.slug, nameAr: row.nameAr, from: current.basePriceMinor, to: row.priceMinor });
    }

    if (changes.length === 0) unchanged += 1;
    else update.push({ row, changes, ...ref });
  }

  return { newCategories, create, update, unchanged, priceChanges };
}
