import { describe, expect, it } from "vitest";
import { encodePlusCode, shortPlusCode } from "@/lib/plus-code";

// Vectors from the Open Location Code specification's own test data, plus the
// restaurant's pin. A Plus Code that is a few metres off still looks right,
// which is why these are exact strings and not "matches the pattern".

describe("encodePlusCode", () => {
  it("matches the specification's test vectors", () => {
    expect(encodePlusCode(47.0000625, 8.0000625)).toBe("8FVC2222+22");
    expect(encodePlusCode(37.4220656, -122.0840897)).toBe("849VCWC8+R9");
    expect(encodePlusCode(-41.2730625, 174.7859375)).toBe("4VCPPQGP+Q9");
  });

  it("encodes the restaurant's pin as the code printed on its Maps listing", () => {
    // 14.4891696, 49.0444845 — the pin from the owner's own Google Maps link.
    expect(encodePlusCode(14.4891696, 49.0444845)).toBe("7H6FF2QV+MQ");
    expect(shortPlusCode(14.4891696, 49.0444845)).toBe("F2QV+MQ");
  });

  it("handles the edges of the map without throwing", () => {
    expect(encodePlusCode(90, 180)).toMatch(/^[0-9A-Z]{8}\+[0-9A-Z]{2}$/);
    expect(encodePlusCode(-90, -180)).toBe("22222222+22");
    expect(encodePlusCode(0, 360)).toBe(encodePlusCode(0, 0));
  });

  it("refuses coordinates that are not numbers", () => {
    expect(() => encodePlusCode(Number.NaN, 0)).toThrow(RangeError);
    expect(() => encodePlusCode(0, Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  it("uses only the Plus Code alphabet, which has no vowels or look-alikes", () => {
    const code = encodePlusCode(14.4891696, 49.0444845).replace("+", "");
    expect(code).not.toMatch(/[AEIOULBDKNSTY01]/);
  });
});
