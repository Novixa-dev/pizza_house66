import { describe, expect, it } from "vitest";
import {
  IMPORT_MAX_ROWS,
  generateCategorySlug,
  generateSlug,
  normalizeNumber,
  parseCsv,
  parseMenuCsv,
  planImport,
  type ExistingCategory,
  type ExistingProduct,
} from "@/lib/menu-import";

// The import writes prices customers are charged, so these are written around
// the ways it could go quietly wrong rather than around the happy path alone.

const HEADER = "category,name_ar,name_en,price";

describe("parseCsv", () => {
  it("reads quoted fields, doubled quotes and commas inside quotes", () => {
    expect(parseCsv('a,"b,c","say ""hi"""\n1,2,3')).toEqual([
      ["a", "b,c", 'say "hi"'],
      ["1", "2", "3"],
    ]);
  });

  it("keeps a newline that is inside quotes", () => {
    expect(parseCsv('a,"line one\nline two"\nx,y')).toEqual([
      ["a", "line one\nline two"],
      ["x", "y"],
    ]);
  });

  it("handles CRLF, a trailing newline and a byte-order mark", () => {
    expect(parseCsv("﻿a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("detects the semicolon Excel writes in some regional settings", () => {
    expect(parseCsv("category;name_ar;price\nبيتزا;مارجريتا;4500")).toEqual([
      ["category", "name_ar", "price"],
      ["بيتزا", "مارجريتا", "4500"],
    ]);
  });

  it("does not mistake a comma file for a semicolon one because of a semicolon in a value", () => {
    expect(parseCsv('a,b\n"x;y",z')).toEqual([
      ["a", "b"],
      ["x;y", "z"],
    ]);
  });
});

describe("normalizeNumber", () => {
  it("turns Arabic-Indic and Persian digits into ASCII", () => {
    expect(normalizeNumber("٤٥٠٠")).toBe("4500");
    expect(normalizeNumber("۴۵۰۰")).toBe("4500");
  });

  it("drops thousands separators and spaces", () => {
    expect(normalizeNumber("1,700")).toBe("1700");
    expect(normalizeNumber("١٬٧٠٠")).toBe("1700");
    expect(normalizeNumber("38 500")).toBe("38500");
  });

  it("keeps an Arabic decimal mark as a point, so a fraction is caught rather than swallowed", () => {
    expect(normalizeNumber("٤٫٥")).toBe("4.5");
  });
});

describe("slugs", () => {
  it("are stable for the same category and name, so a re-import updates instead of duplicating", () => {
    expect(generateSlug("بيتزا", "مارجريتا")).toBe(generateSlug("بيتزا", "مارجريتا"));
  });

  it("ignore stray whitespace in a spreadsheet cell", () => {
    expect(generateSlug(" بيتزا ", "مارجريتا   كبيرة")).toBe(generateSlug("بيتزا", "مارجريتا كبيرة"));
  });

  it("differ between categories, since the same name can legitimately appear in two", () => {
    expect(generateSlug("بيتزا", "جبن")).not.toBe(generateSlug("فطائر", "جبن"));
  });

  it("are valid URL slugs", () => {
    expect(generateSlug("بيتزا", "مارجريتا")).toMatch(/^m-[0-9a-f]{8}$/);
    expect(generateCategorySlug("بيتزا")).toMatch(/^c-[0-9a-f]{8}$/);
  });
});

describe("parseMenuCsv — valid input", () => {
  it("reads a row, converting the price once", () => {
    const { rows, errors } = parseMenuCsv(`${HEADER}\nبيتزا,مارجريتا,Margherita,4500`);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      category: "بيتزا",
      nameAr: "مارجريتا",
      nameEn: "Margherita",
      nameEnMissing: false,
      priceMinor: 4500, // YER has no subunit
    });
  });

  it("accepts Arabic digits and thousands separators in the price", () => {
    const { rows, errors } = parseMenuCsv(`${HEADER}\nبيتزا,كبيرة,,"38,500"\nبيتزا,صغيرة,,١٢٠٠`);
    expect(errors).toEqual([]);
    expect(rows.map((row) => row.priceMinor)).toEqual([38500, 1200]);
  });

  it("accepts Arabic column headers", () => {
    const { rows, errors } = parseMenuCsv("القسم,الاسم,السعر\nبيتزا,مارجريتا,4500");
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({ category: "بيتزا", nameAr: "مارجريتا", priceMinor: 4500 });
  });

  it("falls back to the Arabic name for English and says so", () => {
    const { rows, warnings } = parseMenuCsv(`${HEADER}\nبيتزا,مارجريتا,,4500`);
    expect(rows[0]).toMatchObject({ nameEn: "مارجريتا", nameEnMissing: true });
    expect(warnings.some((warning) => /no name_en/.test(warning.message))).toBe(true);
  });

  it("reads status, prep time and featured when given", () => {
    const { rows, errors } = parseMenuCsv(
      "category,name_ar,price,status,prep_minutes,featured\nبيتزا,مارجريتا,4500,sold_out,25,نعم"
    );
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({ status: "SOLD_OUT", prepMinutes: 25, featured: true });
  });

  it("skips blank lines without counting them as rows or errors", () => {
    const { rows, errors } = parseMenuCsv(`${HEADER}\nبيتزا,أ,,100\n,,,\n\nبيتزا,ب,,200\n`);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(2);
  });

  it("numbers rows by their line in the file, header included", () => {
    const { rows } = parseMenuCsv(`${HEADER}\nبيتزا,أ,,100\nبيتزا,ب,,200`);
    expect(rows.map((row) => row.line)).toEqual([2, 3]);
  });
});

describe("parseMenuCsv — what must stop the import", () => {
  const errorsFor = (body: string) => parseMenuCsv(`${HEADER}\n${body}`).errors;

  it("refuses an empty file", () => {
    expect(parseMenuCsv("").errors).toHaveLength(1);
  });

  it("refuses a file with a required column missing, and names it", () => {
    const { errors } = parseMenuCsv("category,name_ar\nبيتزا,أ");
    expect(errors[0]!.message).toMatch(/price/);
  });

  it("warns about a misspelt column instead of silently dropping it", () => {
    const { warnings, errors } = parseMenuCsv("category,name_ar,pirce\nبيتزا,أ,100");
    expect(warnings.some((warning) => /pirce/.test(warning.message))).toBe(true);
    expect(errors.some((error) => /price/.test(error.message))).toBe(true);
  });

  it("rejects a missing, non-numeric, zero, fractional or enormous price", () => {
    expect(errorsFor("بيتزا,أ,,")[0]!.message).toMatch(/price is required/);
    expect(errorsFor("بيتزا,أ,,abc")[0]!.message).toMatch(/not a number/);
    expect(errorsFor("بيتزا,أ,,0")[0]!.message).toMatch(/greater than zero/);
    expect(errorsFor("بيتزا,أ,,45.5")[0]!.message).toMatch(/fractional/);
    expect(errorsFor("بيتزا,أ,,4500000")[0]!.message).toMatch(/extra digit/);
  });

  it("rejects a negative price", () => {
    expect(errorsFor("بيتزا,أ,,-100")[0]!.message).toMatch(/not a number/);
  });

  it("requires a category and an Arabic name", () => {
    expect(errorsFor(",أ,,100")[0]!.message).toMatch(/category is required/);
    expect(errorsFor("بيتزا,,,100")[0]!.message).toMatch(/name_ar is required/);
  });

  it("rejects an unknown status, a bad prep time and a bad slug", () => {
    const base = "category,name_ar,price,";
    expect(parseMenuCsv(`${base}status\nبيتزا,أ,100,maybe`).errors[0]!.message).toMatch(/status/);
    expect(parseMenuCsv(`${base}prep_minutes\nبيتزا,أ,100,500`).errors[0]!.message).toMatch(/prep_minutes/);
    expect(parseMenuCsv(`${base}slug\nبيتزا,أ,100,Bad Slug!`).errors[0]!.message).toMatch(/slug/);
  });

  it("rejects the same product twice, pointing at the first occurrence", () => {
    const errors = errorsFor("بيتزا,أ,,100\nبيتزا,أ,,200");
    expect(errors).toHaveLength(1);
    expect(errors[0]!.line).toBe(3);
    expect(errors[0]!.message).toMatch(/duplicates line 2/);
  });

  it("treats the same name in two categories as two products", () => {
    expect(errorsFor("بيتزا,جبن,,100\nفطائر,جبن,,100")).toEqual([]);
  });

  it("reports every bad row, not just the first", () => {
    expect(errorsFor("بيتزا,أ,,abc\nبيتزا,ب,,0\nبيتزا,ج,,100")).toHaveLength(2);
  });

  it("refuses a file over the row limit", () => {
    const body = Array.from({ length: IMPORT_MAX_ROWS + 1 }, (_, i) => `بيتزا,صنف ${i},,100`).join("\n");
    expect(errorsFor(body)[0]!.message).toMatch(/Split the file/);
  });
});

// --------------------------------------------------------------------------

const PIZZA: ExistingCategory = { id: "cat-pizza", slug: "pizza", nameAr: "بيتزا", nameEn: "Pizza" };

function product(overrides: Partial<ExistingProduct> = {}): ExistingProduct {
  return {
    slug: generateSlug("بيتزا", "مارجريتا"),
    categoryId: "cat-pizza",
    nameAr: "مارجريتا",
    nameEn: "Margherita",
    descriptionAr: "وصف",
    descriptionEn: "Description",
    basePriceMinor: 4500,
    availability: "AVAILABLE",
    prepMinutes: 20,
    featured: false,
    ...overrides,
  };
}

function rowsFrom(csv: string) {
  const parsed = parseMenuCsv(csv);
  expect(parsed.errors).toEqual([]);
  return parsed.rows;
}

describe("planImport", () => {
  it("creates a product that does not exist, as a draft by default", () => {
    const plan = planImport(rowsFrom(`${HEADER}\nبيتزا,تونة,Tuna,5800`), { categories: [PIZZA], products: [] });
    expect(plan.create).toHaveLength(1);
    expect(plan.create[0]!.resolvedStatus).toBe("HIDDEN");
    expect(plan.update).toEqual([]);
  });

  it("publishes new products only when asked to", () => {
    const plan = planImport(
      rowsFrom(`${HEADER}\nبيتزا,تونة,Tuna,5800`),
      { categories: [PIZZA], products: [] },
      { defaultStatus: "AVAILABLE" }
    );
    expect(plan.create[0]!.resolvedStatus).toBe("AVAILABLE");
  });

  it("lets a row's own status win over the default", () => {
    const plan = planImport(
      rowsFrom("category,name_ar,price,status\nبيتزا,تونة,5800,SOLD_OUT"),
      { categories: [PIZZA], products: [] },
      { defaultStatus: "AVAILABLE" }
    );
    expect(plan.create[0]!.resolvedStatus).toBe("SOLD_OUT");
  });

  it("counts an identical row as unchanged, so a re-import is a no-op", () => {
    const plan = planImport(rowsFrom(`${HEADER}\nبيتزا,مارجريتا,Margherita,4500`), {
      categories: [PIZZA],
      products: [product()],
    });
    expect(plan).toMatchObject({ unchanged: 1, create: [], update: [], priceChanges: [] });
  });

  it("flags a changed price loudly and separately, since it is what customers are charged", () => {
    const plan = planImport(rowsFrom(`${HEADER}\nبيتزا,مارجريتا,Margherita,5000`), {
      categories: [PIZZA],
      products: [product()],
    });
    expect(plan.update).toHaveLength(1);
    expect(plan.priceChanges).toEqual([
      { slug: product().slug, nameAr: "مارجريتا", from: 4500, to: 5000 },
    ]);
  });

  it("never clears a field because its cell is blank", () => {
    // A file carrying only names and prices must not wipe the descriptions,
    // the prep time or the availability already in the database.
    const plan = planImport(rowsFrom("category,name_ar,price\nبيتزا,مارجريتا,4500"), {
      categories: [PIZZA],
      products: [product({ descriptionAr: "وصف", prepMinutes: 25, availability: "SOLD_OUT" })],
    });
    expect(plan.update).toEqual([]);
    expect(plan.unchanged).toBe(1);
  });

  it("does not overwrite a real English name with the Arabic fallback", () => {
    const plan = planImport(rowsFrom("category,name_ar,price\nبيتزا,مارجريتا,4500"), {
      categories: [PIZZA],
      products: [product({ nameEn: "Margherita" })],
    });
    expect(plan.update).toEqual([]);
  });

  it("does not touch availability unless the file gives a status", () => {
    const plan = planImport(rowsFrom(`${HEADER}\nبيتزا,مارجريتا,Margherita,4500`), {
      categories: [PIZZA],
      products: [product({ availability: "SOLD_OUT" })],
    });
    expect(plan.update).toEqual([]);
  });

  it("matches a category by whitespace-normalised Arabic name", () => {
    const plan = planImport(rowsFrom(`${HEADER}\n  بيتزا  ,تونة,,5800`), { categories: [PIZZA], products: [] });
    expect(plan.newCategories).toEqual([]);
  });

  it("matches a category by slug as well", () => {
    const plan = planImport(rowsFrom(`${HEADER}\npizza,تونة,,5800`), { categories: [PIZZA], products: [] });
    expect(plan.newCategories).toEqual([]);
  });

  it("creates a missing category exactly once, however many rows use it", () => {
    const plan = planImport(rowsFrom(`${HEADER}\nقهوة,لاتيه,,3300\nقهوة,موكا,,3800`), {
      categories: [PIZZA],
      products: [],
    });
    expect(plan.newCategories).toHaveLength(1);
    expect(plan.newCategories[0]).toMatchObject({ nameAr: "قهوة", slug: generateCategorySlug("قهوة") });
    expect(plan.create).toHaveLength(2);
  });

  it("shows a move between categories by name", () => {
    const other: ExistingCategory = { id: "cat-pastry", slug: "pastry", nameAr: "فطائر", nameEn: "Pastries" };
    const plan = planImport(rowsFrom(`${HEADER}\nفطائر,مارجريتا,Margherita,4500`), {
      categories: [PIZZA, other],
      products: [product({ slug: generateSlug("فطائر", "مارجريتا"), categoryId: "cat-pizza" })],
    });
    expect(plan.update[0]!.changes).toContainEqual({ field: "category", from: "بيتزا", to: "فطائر" });
  });

  it("treats a row naming a not-yet-existing category as a move too", () => {
    const plan = planImport(rowsFrom(`${HEADER}\nقهوة,مارجريتا,Margherita,4500`), {
      categories: [PIZZA],
      products: [product({ slug: generateSlug("قهوة", "مارجريتا") })],
    });
    expect(plan.newCategories).toHaveLength(1);
    expect(plan.update[0]!.changes).toContainEqual({ field: "category", from: "بيتزا", to: "قهوة" });
  });

  it("never plans a deletion: a product absent from the file is simply not mentioned", () => {
    const plan = planImport(rowsFrom(`${HEADER}\nبيتزا,تونة,,5800`), {
      categories: [PIZZA],
      products: [product()],
    });
    expect(plan.create).toHaveLength(1);
    expect(plan.update).toEqual([]);
    expect(plan.unchanged).toBe(0);
    expect(Object.keys(plan)).not.toContain("delete");
  });
});

// --------------------------------------------------------------------------
// Added after reading the importer back adversarially. Each of these is a way
// it used to go quietly wrong on a file a real owner would plausibly produce.
// --------------------------------------------------------------------------

describe("separators are read for what they are", () => {
  it("treats a comma as grouping only when it groups digits in threes", () => {
    expect(normalizeNumber("4,500")).toBe("4500");
    expect(normalizeNumber("4,500,000")).toBe("4500000");
    expect(normalizeNumber("١٬٧٠٠")).toBe("1700");
  });

  it("treats any other comma as a decimal mark, so it cannot become a tenfold price", () => {
    // European-locale spreadsheets write 45,5. Stripping the comma made that 455.
    expect(normalizeNumber("45,5")).toBe("45.5");
    expect(normalizeNumber("1,7000")).toBe("1.7000");
    expect(normalizeNumber("1,70")).toBe("1.70");
  });

  it("drops apostrophe grouping", () => {
    expect(normalizeNumber("4'500")).toBe("4500");
  });

  it("rejects a decimal-comma price instead of importing a price ten times too high", () => {
    const { rows, errors } = parseMenuCsv('category,name_ar,price\nبيتزا,أ,"45,5"');
    expect(rows).toEqual([]);
    expect(errors[0]!.message).toMatch(/fractional/);
  });

  it("rejects European thousands-dots too, and says what to write", () => {
    const { errors } = parseMenuCsv('category,name_ar,price\nبيتزا,أ,"1.700"');
    expect(errors[0]!.message).toMatch(/fractional/);
    expect(errors[0]!.message).toMatch(/1700/);
  });

  it("still reads an ordinary grouped price", () => {
    const { rows, errors } = parseMenuCsv('category,name_ar,price\nبيتزا,أ,"4,500"');
    expect(errors).toEqual([]);
    expect(rows[0]!.priceMinor).toBe(4500);
  });
});

describe("a file that is not UTF-8", () => {
  it("is refused, with the instruction that fixes it", () => {
    // Arabic Excel's plain "CSV" is Windows-1256. Its bytes are not valid UTF-8,
    // so reading it as UTF-8 yields U+FFFD for every Arabic letter. Without this
    // check the import would succeed and write a menu of replacement characters.
    const { rows, errors } = parseMenuCsv("category,name_ar,price\n���,���,100");
    expect(rows).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toMatch(/UTF-8/);
    expect(errors[0]!.message).toMatch(/CSV UTF-8/);
  });

  it("does not trip on genuine Arabic text", () => {
    expect(parseMenuCsv(`${HEADER}\nبيتزا,مارجريتا,Margherita,4500`).errors).toEqual([]);
  });
});

describe("duplicates that the slug cannot catch", () => {
  it("warns when two rows share a category and name but have different explicit slugs", () => {
    const { rows, errors, warnings } = parseMenuCsv(
      "category,slug,name_ar,price\nبيتزا,margherita,مارجريتا,4500\nبيتزا,margherita-2,مارجريتا,5500"
    );
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(2); // allowed — a restaurant can sell two things under one name
    expect(warnings.some((warning) => /same name as line 2/.test(warning.message))).toBe(true);
  });
});

describe("planImport — where each product goes", () => {
  it("matches a category slug whatever its capitalisation", () => {
    const plan = planImport(rowsFrom(`${HEADER}\nPizza,تونة,,5800`), { categories: [PIZZA], products: [] });
    expect(plan.newCategories).toEqual([]);
    expect(plan.create[0]).toMatchObject({ categoryId: "cat-pizza", newCategorySlug: null });
  });

  it("hands each product its category, so the writer never re-matches names", () => {
    const plan = planImport(rowsFrom(`${HEADER}\nبيتزا,تونة,,5800\nقهوة,لاتيه,,3300`), {
      categories: [PIZZA],
      products: [],
    });
    const tuna = plan.create.find((row) => row.nameAr === "تونة")!;
    const latte = plan.create.find((row) => row.nameAr === "لاتيه")!;

    expect(tuna).toMatchObject({ categoryId: "cat-pizza", newCategorySlug: null });
    expect(latte).toMatchObject({ categoryId: null, newCategorySlug: generateCategorySlug("قهوة") });
    // ...and the slug it points at is one the plan actually creates.
    expect(plan.newCategories.map((category) => category.slug)).toContain(latte.newCategorySlug);
  });

  it("does the same for an update that moves a product into a new category", () => {
    const plan = planImport(rowsFrom(`${HEADER}\nقهوة,مارجريتا,Margherita,4500`), {
      categories: [PIZZA],
      products: [product({ slug: generateSlug("قهوة", "مارجريتا") })],
    });
    expect(plan.update[0]).toMatchObject({ categoryId: null, newCategorySlug: generateCategorySlug("قهوة") });
  });
});
