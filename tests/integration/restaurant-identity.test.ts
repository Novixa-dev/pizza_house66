import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";

// The facts about where the restaurant is, which are the facts a customer acts
// on: they drive here, they phone this number.
//
// These are not checked against the real world — a test cannot do that. They
// guard the specific regression that happened once: the map link was a text
// search ("?q=Pizza+House+66"), which resolves to whichever "Pizza House"
// Google ranks first. The restaurant has said publicly that it has one branch
// and no connection to anything else using the name, and a different business
// called "Pizza House" does exist in the same region — so a search link can
// send a customer to the wrong restaurant, and gives no sign anything is wrong.

const prisma = new PrismaClient();

afterAll(async () => {
  await prisma.$disconnect();
});

describe("restaurant identity", () => {
  it("links to the restaurant's own map listing, not to a text search", async () => {
    const restaurant = await prisma.restaurant.findFirstOrThrow();

    expect(restaurant.mapUrl, "mapUrl must be set").toBeTruthy();
    const url = new URL(restaurant.mapUrl!);

    expect(
      ["maps.app.goo.gl", "www.google.com", "google.com", "goo.gl"].includes(url.hostname),
      `mapUrl should be a Google Maps link, got ${url.hostname}`
    ).toBe(true);
    expect(
      url.searchParams.has("q") || url.searchParams.has("query"),
      "a ?q= search link resolves to whichever place Maps ranks first"
    ).toBe(false);
  });

  it("has coordinates, and they are in Al Mukalla", async () => {
    const restaurant = await prisma.restaurant.findFirstOrThrow();

    expect(restaurant.latitude, "latitude feeds the structured-data geo field").not.toBeNull();
    expect(restaurant.longitude).not.toBeNull();

    // A box around the city: generous enough to survive a re-pinned entrance,
    // tight enough to catch swapped latitude/longitude or a pin in another
    // governorate.
    expect(restaurant.latitude!).toBeGreaterThan(14.3);
    expect(restaurant.latitude!).toBeLessThan(14.7);
    expect(restaurant.longitude!).toBeGreaterThan(48.8);
    expect(restaurant.longitude!).toBeLessThan(49.3);
  });
});
