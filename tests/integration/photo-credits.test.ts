import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { creditFor, wikimediaFileName, WIKIMEDIA_CREDITS } from "@/lib/photo-credits";

// Keeps the credits page honest.
//
// Six of the menu photographs are CC BY or CC BY-SA, which require the
// photographer to be named wherever the work appears. The credit lives in
// `src/lib/photo-credits.ts` and the photograph lives in the database, so
// nothing but this test connects them: swap a dish photo for another
// Wikimedia file and the site is using it uncredited, with no error anywhere.
//
// Only the forward direction is asserted. A credit left behind for a
// photograph no longer on the menu is harmless — crediting a photographer
// you have stopped using breaks nothing — while a photograph with no credit
// is a licence breach.

const prisma = new PrismaClient();

afterAll(async () => {
  await prisma.$disconnect();
});

describe("menu photo attribution", () => {
  it("credits every Wikimedia photograph the menu actually uses", async () => {
    const products = await prisma.product.findMany({
      where: { availability: { not: "HIDDEN" } },
      select: { slug: true, imageUrl: true },
    });

    const uncredited = products
      .map((product) => ({ slug: product.slug, file: wikimediaFileName(product.imageUrl) }))
      .filter((row): row is { slug: string; file: string } => row.file !== null)
      .filter((row) => creditFor(row.file) === undefined);

    expect(
      uncredited,
      `These products use a Wikimedia photograph with no entry in ` +
        `src/lib/photo-credits.ts, so the site shows it uncredited:\n` +
        uncredited.map((row) => `  ${row.slug} → ${row.file}`).join("\n")
    ).toEqual([]);
  });

  it("finds at least one credited photograph, so a passing test means something", async () => {
    // Guards the case where the parser stops matching and every product looks
    // like it has no Wikimedia photo at all — which would make the test above
    // pass by finding nothing to check.
    const products = await prisma.product.findMany({ select: { imageUrl: true } });
    const credited = products.filter((product) => wikimediaFileName(product.imageUrl) !== null);

    expect(credited.length).toBeGreaterThan(0);
  });

  it("gives every credit a licence link, since the licence is what requires it", () => {
    for (const credit of WIKIMEDIA_CREDITS) {
      expect(credit.author.trim()).not.toBe("");
      expect(credit.license.trim()).not.toBe("");
      expect(credit.licenseUrl).toMatch(/^https:\/\//);
      expect(credit.sourceUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
    }
  });
});
