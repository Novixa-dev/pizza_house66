/**
 * Search that forgives how Arabic is typed.
 *
 * A menu search that is a plain substring match fails exactly where it is
 * needed. On a phone keyboard people type ا for أ, ه for ة at the end of a
 * word, ي for ى — and a menu that spells it the other way answers "nothing
 * found" to a perfectly good query. Nobody reads that as "my spelling differs
 * from theirs"; they read it as "they do not sell it".
 *
 * So both sides of the comparison — what the product is called and what was
 * typed — are folded to one spelling first. This is the standard Arabic
 * search normalisation (the same set Elasticsearch's `arabic_normalization`
 * applies), plus the two Persian letters that arrive in pasted text and the
 * digits, since "House 66" is as likely to be typed ٦٦ as 66.
 *
 * What it deliberately does not do: it does not treat ج and غ as the same
 * letter. مارجريتا and مارغريتا are two spellings of one foreign word, but
 * there is no rule that tells that from two different words; guessing would
 * make real distinctions unsearchable.
 *
 * Pure and dependency-free, so the customer's menu (a client component) and
 * the staff product list (a server component) share one definition of "the
 * same spelling" instead of drifting apart.
 */

// Letter marks (harakat and Quranic annotation signs) and the tatweel that
// stretches a letter. Menus rarely have them; text pasted from elsewhere does.
const MARKS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;

/** أ إ آ ٱ → ا */
const ALEF_VARIANTS = /[\u0623\u0625\u0622\u0671]/g;
/** ى (alef maqsura) and ی (Persian yeh) → ي */
const YEH_VARIANTS = /[\u0649\u06CC]/g;
/** ک (Persian keheh) → ك */
const KAF_VARIANT = /\u06A9/g;
/** ة (ta marbuta) → ه — people end a word with either */
const TA_MARBUTA = /\u0629/g;
/** ٠-٩ (Arabic-Indic digits) */
const ARABIC_INDIC_DIGITS = /[\u0660-\u0669]/g;
/** ۰-۹ (Extended Arabic-Indic digits) */
const PERSIAN_DIGITS = /[\u06F0-\u06F9]/g;

/**
 * Folds text so that spellings people use interchangeably compare equal.
 * Idempotent: folding folded text changes nothing.
 */
export function foldForSearch(text: string): string {
  return (
    text
      // Presentation forms (the shaped glyphs a PDF or a copied web page can
      // carry) back to the plain letters they stand for.
      .normalize("NFKC")
      .toLowerCase()
      .replace(MARKS, "")
      .replace(ALEF_VARIANTS, "\u0627")
      .replace(YEH_VARIANTS, "\u064A")
      .replace(KAF_VARIANT, "\u0643")
      .replace(TA_MARBUTA, "\u0647")
      .replace(ARABIC_INDIC_DIGITS, (digit) => String(digit.charCodeAt(0) - 0x0660))
      .replace(PERSIAN_DIGITS, (digit) => String(digit.charCodeAt(0) - 0x06f0))
      .replace(/\s+/g, " ")
      .trim()
  );
}

/** The folded words of a query. Empty when there is nothing to search for. */
export function searchTokens(query: string): string[] {
  const folded = foldForSearch(query);
  return folded === "" ? [] : folded.split(" ");
}

/**
 * Everything a product can be found by, folded once. Compute this when the
 * data arrives, not on every keystroke.
 */
export function searchHaystack(...fields: readonly (string | null | undefined)[]): string {
  return foldForSearch(fields.filter((field): field is string => Boolean(field)).join(" "));
}

/**
 * Whether every word of the query appears somewhere in the haystack, in any
 * order. "chicken ranch" finds "Ranch Chicken Pizza"; a phrase that was a
 * substring before is still a match, so this only ever finds more.
 */
export function matchesTokens(tokens: readonly string[], haystack: string): boolean {
  return tokens.every((token) => haystack.includes(token));
}
