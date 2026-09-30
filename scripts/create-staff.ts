/**
 * Creates or updates a staff account from the command line.
 *
 * This exists so a production deployment never has to run the demo seed to
 * get its first login. Shipping a known default password is how demo
 * credentials end up live (docs/PRD.md §39 "no default production
 * credentials"), so production seeds no staff at all — this script is the
 * supported way in.
 *
 *   npm run staff:create -- --email owner@example.com --name "Owner" --role OWNER
 *
 * The password is read from STAFF_PASSWORD, or prompted for if a TTY is
 * available, so it never lands in shell history.
 */

import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { PrismaClient, type Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const ROLES: Role[] = ["OWNER", "MANAGER", "CASHIER", "KITCHEN"];

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index !== -1 ? process.argv[index + 1] : undefined;
}

async function readPassword(): Promise<string> {
  const fromEnv = process.env.STAFF_PASSWORD;
  if (fromEnv) return fromEnv;

  if (!stdin.isTTY) {
    throw new Error("Set STAFF_PASSWORD, or run this from an interactive terminal.");
  }
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    return await rl.question("Password (min 8 characters): ");
  } finally {
    rl.close();
  }
}

async function main() {
  const email = arg("email")?.trim().toLowerCase();
  const name = arg("name")?.trim();
  const role = (arg("role")?.trim().toUpperCase() ?? "OWNER") as Role;

  if (!email || !name) {
    console.error(
      'Usage: npm run staff:create -- --email <email> --name "<name>" [--role OWNER|MANAGER|CASHIER|KITCHEN]'
    );
    process.exit(1);
  }
  if (!ROLES.includes(role)) {
    console.error(`Invalid role "${role}". Expected one of: ${ROLES.join(", ")}`);
    process.exit(1);
  }

  const password = await readPassword();
  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    create: { email, name, role, passwordHash, active: true },
    update: { name, role, passwordHash, active: true },
  });

  console.log(`Staff account ready: ${user.email} (${user.role})`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
