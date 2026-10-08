/**
 * The production start-up step: seed an empty database once, never touch a
 * populated one. The reason is in src/server/bootstrap.ts.
 *
 *   npm run db:bootstrap
 *
 * Staff accounts are not created here (the seed skips them in production when
 * SEED_STAFF_PASSWORD is unset); the first owner comes from `npm run
 * staff:create`, so no known password is ever shipped.
 */

import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { needsFirstSeed } from "../src/server/bootstrap";

async function main() {
  const prisma = new PrismaClient();
  let first: boolean;
  try {
    first = await needsFirstSeed(prisma);
  } finally {
    await prisma.$disconnect();
  }

  if (!first) {
    console.log("[bootstrap] Database already set up — leaving the restaurant's data alone.");
    return;
  }

  console.log("[bootstrap] Empty database — seeding the starting catalogue, hours and settings.");
  const result = spawnSync("npx", ["tsx", "prisma/seed.ts"], { stdio: "inherit", env: process.env });
  if (result.status !== 0) {
    console.error("[bootstrap] Seeding failed.");
    process.exit(result.status ?? 1);
  }
}

main().catch((error) => {
  console.error("[bootstrap] Could not check the database:", error);
  process.exit(1);
});
