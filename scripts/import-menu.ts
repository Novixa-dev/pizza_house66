/**
 * Imports a menu from a CSV file.
 *
 *   npm run menu:import -- menu.csv              # dry run: shows what would change
 *   npm run menu:import -- menu.csv --apply      # writes it
 *   npm run menu:import -- menu.csv --apply --publish
 *
 * Why this exists: the restaurant's real menu is on the order of 180 items,
 * which is days of work through the admin screens one at a time. The format
 * and every rule are in docs/MENU-IMPORT.md; the parsing and the diff are in
 * src/lib/menu-import.ts, where they are tested without a database.
 *
 * It is cautious by construction:
 *
 *  - A dry run is the default. Nothing is written without --apply.
 *  - Any error in the file stops everything. Half a menu is worse than none.
 *  - Nothing is ever deleted, and a blank cell never clears a value.
 *  - New products arrive HIDDEN, so an import is never the moment unreviewed
 *    prices go in front of customers. --publish makes them live instead.
 *  - Changes to the price of an existing product are listed in full, because
 *    that is the one thing a customer is charged for.
 *  - An applied import writes an audit-log entry.
 */

import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  parseMenuCsv,
  planImport,
  type CategoryRef,
  type ExistingCategory,
  type ExistingProduct,
  type ImportIssue,
} from "../src/lib/menu-import";

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const file = args.find((arg) => !arg.startsWith("--"));
const apply = args.includes("--apply");
const publish = args.includes("--publish");

const WARNING_LIMIT = 25;

function printIssues(label: string, issues: ImportIssue[], limit = Infinity) {
  if (issues.length === 0) return;
  console.log(`\n${label} (${issues.length})`);
  for (const issue of issues.slice(0, limit)) {
    console.log(`  line ${issue.line}: ${issue.message}`);
  }
  if (issues.length > limit) console.log(`  … and ${issues.length - limit} more`);
}

async function main() {
  if (!file) {
    console.error("Usage: npm run menu:import -- <file.csv> [--apply] [--publish]");
    process.exit(2);
  }
  if (publish && !apply) {
    console.error("--publish only means something with --apply.");
    process.exit(2);
  }

  // The currency decides what a "whole number" of the price column means, so it
  // is read from the restaurant rather than assumed to be rials.
  const restaurant = await prisma.restaurant.findFirst({ select: { currency: true } });
  if (!restaurant) {
    console.error("No restaurant is configured. Run the seed first.");
    process.exit(1);
  }

  const parsed = parseMenuCsv(readFileSync(file, "utf8"), restaurant.currency);
  printIssues("Warnings", parsed.warnings, WARNING_LIMIT);
  printIssues("ERRORS", parsed.errors);

  if (parsed.errors.length > 0) {
    console.error(`\n${parsed.errors.length} error(s). Nothing was imported. Fix the file and run it again.`);
    process.exit(1);
  }

  const [categories, products] = await Promise.all([
    prisma.category.findMany({ select: { id: true, slug: true, nameAr: true, nameEn: true, sortOrder: true } }),
    prisma.product.findMany({
      select: {
        slug: true,
        categoryId: true,
        nameAr: true,
        nameEn: true,
        descriptionAr: true,
        descriptionEn: true,
        basePriceMinor: true,
        availability: true,
        prepMinutes: true,
        featured: true,
      },
    }),
  ]);

  const existingCategories: ExistingCategory[] = categories.map((category) => ({
    id: category.id,
    slug: category.slug,
    nameAr: category.nameAr,
    nameEn: category.nameEn,
  }));
  const existingProducts: ExistingProduct[] = products;
  const plan = planImport(
    parsed.rows,
    { categories: existingCategories, products: existingProducts },
    { defaultStatus: publish ? "AVAILABLE" : "HIDDEN" }
  );

  console.log(`\n${parsed.rows.length} rows in ${basename(file)}`);
  console.log(`  new categories : ${plan.newCategories.length}`);
  console.log(`  new products   : ${plan.create.length}  (${publish ? "published" : "hidden until reviewed"})`);
  console.log(`  updated        : ${plan.update.length}`);
  console.log(`  unchanged      : ${plan.unchanged}`);

  for (const category of plan.newCategories) console.log(`    + category ${category.nameAr}`);

  if (plan.priceChanges.length > 0) {
    console.log(`\nPRICE CHANGES on products that already exist (${plan.priceChanges.length}) — check these:`);
    for (const change of plan.priceChanges) {
      console.log(`  ${change.nameAr}: ${change.from.toLocaleString("en")} → ${change.to.toLocaleString("en")}`);
    }
  }

  if (!apply) {
    console.log("\nDry run — nothing was written. Re-run with --apply to import.");
    return;
  }

  const nextCategorySort = Math.max(0, ...categories.map((category) => category.sortOrder)) + 10;

  await prisma.$transaction(
    async (tx) => {
      // New categories first, remembered by slug. Which category a product goes
      // to was already decided by the plan; this only turns "the new one called
      // c-1a2b3c4d" into the id it was just given.
      const createdBySlug = new Map<string, string>();
      for (const [index, category] of plan.newCategories.entries()) {
        const created = await tx.category.create({
          data: {
            slug: category.slug,
            nameAr: category.nameAr,
            nameEn: category.nameEn,
            sortOrder: nextCategorySort + index * 10,
          },
        });
        createdBySlug.set(category.slug, created.id);
      }

      const resolve = (ref: CategoryRef): string => {
        const id = ref.categoryId ?? (ref.newCategorySlug ? createdBySlug.get(ref.newCategorySlug) : undefined);
        if (!id) throw new Error("A product's category could not be resolved. Nothing was written.");
        return id;
      };

      for (const row of plan.create) {
        await tx.product.create({
          data: {
            slug: row.slug,
            categoryId: resolve(row),
            nameAr: row.nameAr,
            nameEn: row.nameEn,
            descriptionAr: row.descriptionAr,
            descriptionEn: row.descriptionEn,
            basePriceMinor: row.priceMinor,
            availability: row.resolvedStatus,
            featured: row.featured ?? false,
            prepMinutes: row.prepMinutes,
            // File order, in steps of ten so a manager can slot an item between two.
            sortOrder: row.line * 10,
          },
        });
      }

      for (const { row, changes, categoryId, newCategorySlug } of plan.update) {
        const touched = new Set(changes.map((change) => change.field));
        await tx.product.update({
          where: { slug: row.slug },
          data: {
            ...(touched.has("category") ? { categoryId: resolve({ categoryId, newCategorySlug }) } : {}),
            ...(touched.has("nameAr") ? { nameAr: row.nameAr } : {}),
            ...(touched.has("nameEn") ? { nameEn: row.nameEn } : {}),
            ...(touched.has("descriptionAr") ? { descriptionAr: row.descriptionAr } : {}),
            ...(touched.has("descriptionEn") ? { descriptionEn: row.descriptionEn } : {}),
            ...(touched.has("basePriceMinor") ? { basePriceMinor: row.priceMinor } : {}),
            ...(touched.has("prepMinutes") ? { prepMinutes: row.prepMinutes } : {}),
            ...(touched.has("featured") ? { featured: row.featured ?? false } : {}),
            ...(touched.has("availability") && row.status ? { availability: row.status } : {}),
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorName: "menu-import CLI",
          action: "menu.import",
          entity: "Menu",
          metadata: {
            file: basename(file),
            rows: parsed.rows.length,
            newCategories: plan.newCategories.length,
            created: plan.create.length,
            updated: plan.update.length,
            priceChanges: plan.priceChanges.length,
            published: publish,
          },
        },
      });
    },
    { timeout: 60_000 }
  );

  console.log(
    `\nImported: ${plan.create.length} created, ${plan.update.length} updated` +
      (publish ? "." : `. New products are hidden — review them under Admin → Products, then make them available.`)
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
