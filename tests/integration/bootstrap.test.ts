import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { prisma } from "@/lib/db";
import { needsFirstSeed } from "@/server/bootstrap";

// The demo seed overwrites prices and hides every product it does not know.
// These pin that a populated database is never put through it again.

describe("needsFirstSeed", () => {
  it("is true only when no restaurant exists", async () => {
    expect(await needsFirstSeed({ restaurant: { count: async () => 0 } })).toBe(true);
    expect(await needsFirstSeed({ restaurant: { count: async () => 1 } })).toBe(false);
  });

  it("is false for the real, seeded test database", async () => {
    expect(await needsFirstSeed(prisma)).toBe(false);
  });
});

describe("npm run db:bootstrap on a populated database", () => {
  it("leaves an edited price and a product the seed does not know exactly as they were", async () => {
    const supreme = await prisma.product.findUniqueOrThrow({ where: { slug: "supreme" } });
    const category = await prisma.category.findFirstOrThrow({ where: { active: true } });
    const imported = await prisma.product.create({
      data: {
        slug: "bootstrap-test-imported",
        categoryId: category.id,
        nameAr: "صنف مستورد للاختبار",
        nameEn: "Imported for test",
        descriptionAr: "x",
        descriptionEn: "x",
        basePriceMinor: 1234,
        availability: "AVAILABLE",
      },
    });
    try {
      // What an owner does: change a price in the admin.
      await prisma.product.update({ where: { id: supreme.id }, data: { basePriceMinor: 7777 } });

      execFileSync("npx", ["tsx", "scripts/bootstrap-db.ts"], { stdio: "pipe", env: process.env });

      const afterSupreme = await prisma.product.findUniqueOrThrow({ where: { id: supreme.id } });
      const afterImported = await prisma.product.findUniqueOrThrow({ where: { id: imported.id } });
      expect(afterSupreme.basePriceMinor, "the owner's price survives a restart").toBe(7777);
      expect(afterImported.availability, "an imported product is not hidden by a restart").toBe("AVAILABLE");
      expect(afterImported.basePriceMinor).toBe(1234);
    } finally {
      await prisma.product.update({ where: { id: supreme.id }, data: { basePriceMinor: supreme.basePriceMinor } });
      await prisma.product.delete({ where: { id: imported.id } });
    }
  }, 60_000);
});
