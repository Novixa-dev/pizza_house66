#!/usr/bin/env node
/**
 * Waits for the database to answer before the release command touches it.
 *
 * Railway's private network is not up the instant a container is, so a
 * process that connects immediately can lose the race. A deploy did: five
 * `prisma migrate deploy` attempts in eight seconds, every one of them
 * `P1001: Can't reach database server at postgres.railway.internal:5432`,
 * the restart policy exhausted, and the deployment marked CRASHED — while
 * the Postgres service was healthy the whole time.
 *
 * Retrying here turns that race into a short wait. It is deliberately not a
 * retry around `migrate deploy` itself: a migration that fails for any other
 * reason should fail loudly and immediately, not be attempted four more
 * times against a database it may have already half-changed.
 *
 * Exits 0 as soon as the database answers, non-zero if it never does.
 */

import { PrismaClient } from "@prisma/client";

const DEADLINE_MS = Number(process.env.DB_WAIT_TIMEOUT_MS ?? 90_000);
const FIRST_DELAY_MS = 500;
const MAX_DELAY_MS = 5_000;

/** The host and port only — never the URL, which carries the password. */
function describeTarget() {
  try {
    const url = new URL(process.env.DATABASE_URL ?? "");
    return `${url.hostname}:${url.port || 5432}`;
  } catch {
    return "the configured database";
  }
}

const prisma = new PrismaClient({ log: [] });
const target = describeTarget();
const startedAt = Date.now();
let delay = FIRST_DELAY_MS;
let attempt = 0;

while (Date.now() - startedAt < DEADLINE_MS) {
  attempt += 1;
  try {
    await prisma.$queryRaw`SELECT 1`;
    const waited = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(`[start] ${target} answered after ${waited}s (attempt ${attempt})`);
    await prisma.$disconnect();
    process.exit(0);
  } catch {
    // The reason is always the same one worth acting on — it is not up yet.
    // Anything else surfaces from `migrate deploy` a moment later, with a
    // better message than this loop could produce.
    console.log(`[start] waiting for ${target}… (attempt ${attempt})`);
    await new Promise((resolve) => setTimeout(resolve, delay));
    delay = Math.min(delay * 2, MAX_DELAY_MS);
  }
}

console.error(
  `[start] ${target} did not answer within ${DEADLINE_MS / 1000}s — giving up so the ` +
    `deployment fails visibly rather than serving a broken app.`
);
await prisma.$disconnect().catch(() => {});
process.exit(1);
