import { PrismaClient } from "@prisma/client";

// Standard Next.js dev-mode singleton to avoid exhausting DB connections
// across hot reloads. See docs/DATABASE.md.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
