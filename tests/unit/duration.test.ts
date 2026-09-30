import { describe, expect, it } from "vitest";
import { describeDuration } from "@/lib/duration";

// The kitchen board is read from across a room. It was printing every
// duration as raw minutes whatever the size, so a stale order wore a red
// badge reading "متأخر 6862" — four digits and no unit at all.

describe("describeDuration", () => {
  it("says minutes while minutes are what matters", () => {
    expect(describeDuration(45, "en")).toBe("45 minutes");
    expect(describeDuration(45, "ar")).toBe("45 دقيقة");
  });

  it("keeps the minutes while an hour or two out, where they change a decision", () => {
    expect(describeDuration(75, "en")).toBe("1 hour 15 minutes");
    expect(describeDuration(75, "ar")).toBe("ساعة و15 دقيقة");
  });

  it("drops the minutes once they are noise", () => {
    // 318 minutes used to render as "318 دقيقة", which nobody parses at a
    // glance. Five hours out, the eighteen minutes change nothing.
    expect(describeDuration(318, "en")).toBe("5 hours");
    expect(describeDuration(318, "ar")).toBe("5 ساعات");
  });

  it("says days for something that has been sitting for days", () => {
    // The badge that started this: 6862 minutes.
    expect(describeDuration(6862, "en")).toBe("4 days");
    expect(describeDuration(6862, "ar")).toBe("4 أيام");
  });

  it("gets Arabic's three plural forms of one word right", () => {
    // Singular, dual, small plural, then the accusative singular from 11 up.
    // No amount of string concatenation produces these; Intl does.
    expect(describeDuration(1, "ar")).toBe("دقيقة");
    expect(describeDuration(2, "ar")).toBe("دقيقتان");
    expect(describeDuration(3, "ar")).toBe("3 دقائق");
    expect(describeDuration(11, "ar")).toBe("11 دقيقة");
  });

  it("writes Western digits, like every other number in the product", () => {
    // src/lib/time.ts pins the numbering system so one kitchen ticket does
    // not show ٤٥ beside 2,200.
    expect(describeDuration(45, "ar")).not.toMatch(/[٠-٩]/);
    expect(describeDuration(6862, "ar")).not.toMatch(/[٠-٩]/);
  });

  it("treats zero and negatives as no time at all rather than printing a minus", () => {
    expect(describeDuration(0, "en")).toBe("0 minutes");
    expect(describeDuration(-5, "en")).toBe("0 minutes");
  });

  it("rounds to whole minutes", () => {
    expect(describeDuration(44.6, "en")).toBe("45 minutes");
  });

  it("never leaves a unit off, at any size", () => {
    for (const minutes of [0, 1, 30, 59, 60, 61, 119, 180, 1439, 1440, 6862, 100000]) {
      const text = describeDuration(minutes, "en");
      expect(text, `${minutes} rendered as "${text}"`).toMatch(/minute|hour|day/);
    }
  });
});
