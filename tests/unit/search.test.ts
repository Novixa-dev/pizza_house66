import { describe, expect, it } from "vitest";
import { foldForSearch, matchesTokens, searchHaystack, searchTokens } from "@/lib/search";

// A menu search that is a plain substring match answers "nothing found" to a
// customer who typed ه where the menu has ة, or ا where it has أ. That is how
// phones are typed, and nobody reads the empty result as "different spelling"
// — they read it as "they do not sell it". These pin the spellings that must
// compare equal, and the ones that must not.

/** Every spelling in the list must fold to the same string. */
function expectAllEqual(spellings: string[]) {
  const folded = spellings.map(foldForSearch);
  for (const value of folded) expect(value).toBe(folded[0]);
}

describe("foldForSearch", () => {
  it("treats every alef as one letter", () => {
    expectAllEqual(["احمد", "أحمد", "إحمد", "آحمد", "ٱحمد"]);
  });

  it("treats a word-final ة and ه as the same, either way round", () => {
    // The real menu says الخاصة; a phone keyboard types الخاصه.
    expectAllEqual(["بيتزا هاوس سوبريم الخاصة", "بيتزا هاوس سوبريم الخاصه"]);
  });

  it("treats ى and ي as the same", () => {
    expectAllEqual(["مستشفى", "مستشفي"]);
    expectAllEqual(["عيسى", "عيسي"]);
  });

  it("ignores vowel marks and tatweel", () => {
    expectAllEqual(["مرحبا", "مَرْحَبًا", "مـــرحبا"]);
  });

  it("reads Arabic-Indic and Persian digits as the digits they are", () => {
    // "House 66" is as likely to be typed ٦٦ as 66.
    expectAllEqual(["بيتزا هاوس 66", "بيتزا هاوس ٦٦", "بيتزا هاوس ۶۶"]);
    expect(foldForSearch("٠١٢٣٤٥٦٧٨٩")).toBe("0123456789");
    expect(foldForSearch("۰۱۲۳۴۵۶۷۸۹")).toBe("0123456789");
  });

  it("folds the Persian letters that arrive in pasted text", () => {
    expectAllEqual(["كبير", "کبیر"]);
  });

  it("is case-blind for Latin text", () => {
    expectAllEqual(["Margherita", "margherita", "MARGHERITA"]);
  });

  it("collapses runs of whitespace and trims", () => {
    expect(foldForSearch("  بيتزا   دجاج \n رانش ")).toBe("بيتزا دجاج رانش");
  });

  it("turns presentation forms back into the letters they stand for", () => {
    // The shaped glyphs that come with text copied out of a PDF.
    expect(foldForSearch("\uFE8D")).toBe("\u0627"); // isolated alef
    expect(foldForSearch("\uFDF2")).toBe("\u0627\u0644\u0644\u0647"); // the ligature of الله
  });

  it("does not merge letters that are different letters", () => {
    // مارجريتا and مارغريتا are two spellings of one foreign word, but nothing
    // distinguishes that from two different words, so they stay different.
    expect(foldForSearch("مارجريتا")).not.toBe(foldForSearch("مارغريتا"));
    expect(foldForSearch("جبن")).not.toBe(foldForSearch("حبن"));
    expect(foldForSearch("دجاج")).not.toBe(foldForSearch("دحاج"));
  });

  it("is idempotent — folding folded text changes nothing", () => {
    const samples = [
      "إضافات",
      "بيتزا هاوس سوبريم الخاصة",
      "مَرْحَبًا ٦٦",
      "Pizza House Supreme",
      "",
      "   ",
      "ﷲ",
      "کبیر",
    ];
    for (const sample of samples) {
      const once = foldForSearch(sample);
      expect(foldForSearch(once)).toBe(once);
    }
  });

  it("returns an empty string for nothing", () => {
    expect(foldForSearch("")).toBe("");
    expect(foldForSearch("   \n\t ")).toBe("");
    expect(foldForSearch("ــ")).toBe(""); // only tatweel
  });
});

describe("searchTokens", () => {
  it("splits into folded words", () => {
    expect(searchTokens("  الخاصه   بيتزا ")).toEqual(["الخاصه", "بيتزا"]);
    expect(searchTokens("Chicken RANCH")).toEqual(["chicken", "ranch"]);
  });

  it("is empty when there is nothing to search for", () => {
    expect(searchTokens("")).toEqual([]);
    expect(searchTokens("   ")).toEqual([]);
    expect(searchTokens("ـــ")).toEqual([]);
  });
});

describe("searchHaystack and matchesTokens", () => {
  const supreme = searchHaystack(
    "بيتزا هاوس سوبريم الخاصة",
    "Pizza House Supreme",
    "مزيج متكامل من قطع اللحم والدجاج والببروني",
    null,
  );

  it("finds a product however its Arabic was typed", () => {
    expect(matchesTokens(searchTokens("الخاصه"), supreme)).toBe(true); // ه for ة
    expect(matchesTokens(searchTokens("الخاصة"), supreme)).toBe(true);
    expect(matchesTokens(searchTokens("سوبريم"), supreme)).toBe(true);
    expect(matchesTokens(searchTokens("SUPREME"), supreme)).toBe(true);
  });

  it("finds an إ by its bare ا, which is what a phone types", () => {
    const extras = searchHaystack("إضافات", "Extras");
    expect(matchesTokens(searchTokens("اضافات"), extras)).toBe(true);
    expect(matchesTokens(searchTokens("إضافات"), extras)).toBe(true);
  });

  it("needs every word, in any order", () => {
    expect(matchesTokens(searchTokens("house pizza"), supreme)).toBe(true);
    expect(matchesTokens(searchTokens("سوبريم بيتزا"), supreme)).toBe(true);
    expect(matchesTokens(searchTokens("pizza lasagna"), supreme)).toBe(false);
  });

  it("still matches anything a plain substring would have", () => {
    // Multi-word search only ever finds more than before, never less.
    expect(matchesTokens(searchTokens("بيتزا هاوس"), supreme)).toBe(true);
    expect(matchesTokens(searchTokens("house supreme"), supreme)).toBe(true);
  });

  it("matches inside a word, not only at its start", () => {
    expect(matchesTokens(searchTokens("بروني"), supreme)).toBe(true);
    expect(matchesTokens(searchTokens("upreme"), supreme)).toBe(true);
  });

  it("does not match what is not there", () => {
    expect(matchesTokens(searchTokens("زززز"), supreme)).toBe(false);
  });

  it("matches everything when there is no query", () => {
    expect(matchesTokens([], supreme)).toBe(true);
    expect(matchesTokens([], "")).toBe(true);
  });

  it("ignores absent fields instead of searching the word 'null'", () => {
    const bare = searchHaystack("Cola", null, undefined, "");
    expect(bare).toBe("cola");
    expect(matchesTokens(searchTokens("null"), bare)).toBe(false);
    expect(matchesTokens(searchTokens("undefined"), bare)).toBe(false);
  });

  it("does not let a word span two fields", () => {
    // "pizza" at the end of one field and "house" at the start of the next must
    // not make "pizzahouse" match.
    const joined = searchHaystack("Margherita pizza", "house special");
    expect(matchesTokens(searchTokens("pizzahouse"), joined)).toBe(false);
    expect(matchesTokens(searchTokens("pizza house"), joined)).toBe(true);
  });
});
