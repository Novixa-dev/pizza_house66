// First start versus every start after it.
//
// The demo seed (prisma/seed.ts) is written to be re-run: it upserts the
// stand-in catalogue and *overwrites* each product's name, price, category
// and photograph, hides every product it does not know, and deactivates every
// category it does not know. That is right for a demo database and wrong for a
// live one. Run on each container start, as the Railway start command did, it
// would put back the owner's old prices after every restart and hide every
// item the menu importer had loaded — silently, on a day nobody was looking.
//
// So production starts through `npm run db:bootstrap`: seed once, into an
// empty database, and never again. After that the data belongs to the
// restaurant and changes only through the admin, the importer, or a migration.

/** The slice of the Prisma client this needs, so it can be tested without one. */
export interface BootstrapDb {
  restaurant: { count(): Promise<number> };
}

/**
 * True only for a database that has never been set up. Any restaurant row
 * means someone, or a previous start, already did it; the data is left alone.
 */
export async function needsFirstSeed(db: BootstrapDb): Promise<boolean> {
  return (await db.restaurant.count()) === 0;
}
