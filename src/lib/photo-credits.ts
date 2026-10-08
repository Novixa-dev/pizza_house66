// Attribution for the menu photographs.
//
// Six of the seven Wikimedia photographs on the menu are licensed CC BY or
// CC BY-SA, and both require the author to be credited wherever the work is
// used. The site was using them with no credit anywhere, which is a licence
// breach — and one the restaurant would carry, not the agency that built the
// site. A credits page linked from every page is the attribution practice
// Creative Commons' own reuse guidance accepts for web use.
//
// Unsplash's licence does not require attribution, so those six are credited
// as a source rather than per photographer.
//
// Each entry is keyed by the Wikimedia file name that appears in the image
// URL, so a photograph swapped in `prisma/seed.ts` without a credit added
// here is visible as a gap rather than silently uncredited. The restaurant's
// own uploads need no entry: they own those.

export interface PhotoCredit {
  /** The Wikimedia file name, as it appears in the image URL. */
  file: string;
  /** The dish it illustrates, for a reader matching credit to picture. */
  dishAr: string;
  dishEn: string;
  author: string;
  license: string;
  licenseUrl: string;
  sourceUrl: string;
}

const COMMONS = "https://commons.wikimedia.org/wiki/File:";

export const WIKIMEDIA_CREDITS: PhotoCredit[] = [
  {
    file: "Fatayer.jpg",
    dishAr: "فطيرة جبن كرافت بالعسل",
    dishEn: "Cheese and honey fatayer",
    author: "Joe Foodie",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
    sourceUrl: `${COMMONS}Fatayer.jpg`,
  },
  {
    file: "Sfiha2.jpg",
    dishAr: "فطيرة لحم مفروم بالبهارات",
    dishEn: "Spiced minced-meat fatayer",
    author: "Bazel",
    license: "Public domain",
    licenseUrl: "https://en.wikipedia.org/wiki/Public_domain",
    sourceUrl: `${COMMONS}Sfiha2.jpg`,
  },
  {
    file: "Zaatar_Mankousheh.jpg",
    dishAr: "فطيرة لبنة وزعتر بلدي",
    dishEn: "Labneh and za'atar fatayer",
    author: "Elie.ghob",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    sourceUrl: `${COMMONS}Zaatar_Mankousheh.jpg`,
  },
  {
    file: "Garlicbread.jpg",
    dishAr: "خبز بالثوم وجبنة الموزاريلا",
    dishEn: "Garlic bread with mozzarella",
    author: "Popo le Chien",
    license: "CC BY-SA 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
    sourceUrl: `${COMMONS}Garlicbread.jpg`,
  },
  {
    file: "Potato_wedges_at_Mensa_Paderborn_(11956794164).jpg",
    dishAr: "بطاطس ودجز متبلة بالأعشاب",
    dishEn: "Herb potato wedges",
    author: "Luca Hammer",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
    sourceUrl: `${COMMONS}Potato_wedges_at_Mensa_Paderborn_(11956794164).jpg`,
  },
  {
    file: "Fried_Mozzarella_Sticks_at_Millers_Pub_(301456962).jpg",
    dishAr: "أصابع جبنة الموزاريلا المقلية",
    dishEn: "Fried mozzarella sticks",
    author: "Kim Scarborough",
    license: "CC BY-SA 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0/",
    sourceUrl: `${COMMONS}Fried_Mozzarella_Sticks_at_Millers_Pub_(301456962).jpg`,
  },
  {
    file: "Nutella_Pizza.jpg",
    dishAr: "فطيرة النوتيلا والموز الدافئة",
    dishEn: "Warm Nutella and banana pizza",
    author: "Kidz Activities",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
    sourceUrl: `${COMMONS}Nutella_Pizza.jpg`,
  },
];

/**
 * The Wikimedia file name in an image URL, or null for any other source.
 *
 * Used to check that every Wikimedia photograph actually on the menu has a
 * credit — the pairing that rots first when a photo is swapped.
 */
export function wikimediaFileName(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;
  if (!imageUrl.includes("upload.wikimedia.org")) return null;
  // .../commons/thumb/<a>/<ab>/<File name>/<width>px-<File name>
  const match = /\/commons\/thumb\/[0-9a-f]\/[0-9a-f]{2}\/([^/]+)\//.exec(imageUrl);
  return match ? decodeURIComponent(match[1]!) : null;
}

export function creditFor(file: string): PhotoCredit | undefined {
  return WIKIMEDIA_CREDITS.find((credit) => credit.file === file);
}
