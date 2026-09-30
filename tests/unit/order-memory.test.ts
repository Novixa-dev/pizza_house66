import { describe, expect, it } from "vitest";
import {
  MAX_REMEMBERED,
  addRemembered,
  parseRemembered,
  removeRemembered,
  type RememberedOrder,
} from "@/lib/order-memory";

const NOW = new Date("2026-03-10T12:00:00Z");

function order(token: string, daysAgo = 0): RememberedOrder {
  return {
    token,
    reference: `PH-${token.slice(0, 4)}`,
    placedAt: new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString(),
  };
}

const TOKEN = "abcdefghijklmnopqrstuvwx";

describe("parseRemembered", () => {
  it("returns nothing for an empty or absent value", () => {
    expect(parseRemembered(null, NOW)).toEqual([]);
    expect(parseRemembered("", NOW)).toEqual([]);
  });

  it("survives anything that is not the list it expects", () => {
    // This runs on the page whose only job is to recover a lost order, so a
    // corrupted value must produce an empty list, never an exception.
    for (const raw of ["{", "null", '"a string"', "42", '{"not":"an array"}', "[1,2,3]"]) {
      expect(() => parseRemembered(raw, NOW)).not.toThrow();
      expect(parseRemembered(raw, NOW)).toEqual([]);
    }
  });

  it("drops entries that are missing fields or hold the wrong types", () => {
    const raw = JSON.stringify([
      order(TOKEN),
      { token: TOKEN + "2" },
      { token: 7, reference: "PH-1", placedAt: NOW.toISOString() },
      { token: TOKEN + "3", reference: "PH-3", placedAt: "not a date" },
    ]);
    expect(parseRemembered(raw, NOW).map((entry) => entry.token)).toEqual([TOKEN]);
  });

  it("drops entries older than the retention window", () => {
    const raw = JSON.stringify([order(TOKEN, 1), order(TOKEN + "b", 45)]);
    expect(parseRemembered(raw, NOW).map((entry) => entry.token)).toEqual([TOKEN]);
  });

  it("deduplicates by token, keeping the first occurrence", () => {
    const raw = JSON.stringify([order(TOKEN), order(TOKEN)]);
    expect(parseRemembered(raw, NOW)).toHaveLength(1);
  });

  it("returns newest first and caps the list", () => {
    const many = Array.from({ length: MAX_REMEMBERED + 6 }, (_, index) =>
      order(`${TOKEN}${index}`, index)
    );
    const parsed = parseRemembered(JSON.stringify(many), NOW);
    expect(parsed).toHaveLength(MAX_REMEMBERED);
    expect(parsed[0]!.token).toBe(`${TOKEN}0`);
    const times = parsed.map((entry) => Date.parse(entry.placedAt));
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });
});

describe("addRemembered", () => {
  it("puts a new order at the front", () => {
    const list = addRemembered([order(TOKEN, 1)], order(`${TOKEN}new`), NOW);
    expect(list[0]!.token).toBe(`${TOKEN}new`);
    expect(list).toHaveLength(2);
  });

  it("re-adding the same order does not duplicate it", () => {
    const first = addRemembered([], order(TOKEN), NOW);
    const second = addRemembered(first, order(TOKEN), NOW);
    expect(second).toHaveLength(1);
  });

  it("pushes the oldest out once the list is full", () => {
    let list: RememberedOrder[] = [];
    for (let index = 0; index < MAX_REMEMBERED + 3; index += 1) {
      list = addRemembered(list, order(`${TOKEN}${index}`, 0), NOW);
    }
    expect(list).toHaveLength(MAX_REMEMBERED);
  });
});

describe("removeRemembered", () => {
  it("takes out only the named order", () => {
    const list = [order(TOKEN), order(`${TOKEN}b`)];
    expect(removeRemembered(list, TOKEN).map((entry) => entry.token)).toEqual([`${TOKEN}b`]);
    expect(removeRemembered(list, "nothing")).toHaveLength(2);
  });
});
