/**
 * Seeds a realistic, demonstrable Pizza House environment.
 *
 * IMPORTANT — the menu, prices, hours, bank details and contact information
 * below are ILLUSTRATIVE, not the real restaurant's. They exist so the system
 * can be demonstrated and tested end to end with data that behaves like real
 * data (docs/PRD.md §77 — no "Product 1 / Test User" placeholders). Every one
 * of them is listed in docs/ASSUMPTIONS.md and must be replaced with the
 * owner's real values before launch.
 *
 * The seed is idempotent: it upserts by slug/email, so re-running it updates
 * the demo catalog in place rather than duplicating it.
 *
 * Production safety: staff accounts are only seeded when SEED_STAFF_PASSWORD
 * is set, and the script refuses to seed staff in production without it —
 * shipping a known default password is how demo credentials end up live
 * (docs/PRD.md §39 "no default production credentials").
 */

import { LOYALTY_PROMOTION_CODE } from "../src/lib/loyalty";
import { PrismaClient, type AvailabilityState, type PrismaPromise } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const RESTAURANT_SLUG = "pizza-house";

interface OptionValueSeed {
  slug: string;
  nameAr: string;
  nameEn: string;
  priceDeltaMinor?: number;
}

interface OptionGroupSeed {
  slug: string;
  nameAr: string;
  nameEn: string;
  required?: boolean;
  multiSelect?: boolean;
  maxSelect?: number;
  values: OptionValueSeed[];
}

interface ProductSeed {
  slug: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  imageUrl: string;
  basePriceMinor: number;
  availability?: AvailabilityState;
  featured?: boolean;
  badge?: string;
  prepMinutes?: number;
  optionGroups?: OptionGroupSeed[];
}

interface CategorySeed {
  slug: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  icon: string;
  products: ProductSeed[];
}

// Reused across every pizza: one generic option system, not pizza-specific
// columns (docs/PROJECT_ORIGIN.md §53).
const pizzaSizes = (mediumDelta: number, largeDelta: number): OptionGroupSeed => ({
  slug: "size",
  nameAr: "الحجم",
  nameEn: "Size",
  required: true,
  values: [
    { slug: "small", nameAr: "صغير", nameEn: "Small", priceDeltaMinor: 0 },
    { slug: "medium", nameAr: "وسط", nameEn: "Medium", priceDeltaMinor: mediumDelta },
    { slug: "large", nameAr: "كبير", nameEn: "Large", priceDeltaMinor: largeDelta },
  ],
});

const crustGroup: OptionGroupSeed = {
  slug: "crust",
  nameAr: "العجينة",
  nameEn: "Crust",
  required: true,
  values: [
    { slug: "classic", nameAr: "كلاسيكية", nameEn: "Classic", priceDeltaMinor: 0 },
    { slug: "thin", nameAr: "رفيعة", nameEn: "Thin", priceDeltaMinor: 0 },
    { slug: "cheese-stuffed", nameAr: "محشوة بالجبن", nameEn: "Cheese-stuffed", priceDeltaMinor: 600 },
  ],
};

const extrasGroup: OptionGroupSeed = {
  slug: "extras",
  nameAr: "إضافات",
  nameEn: "Extras",
  multiSelect: true,
  maxSelect: 6,
  values: [
    { slug: "extra-cheese", nameAr: "جبن إضافي", nameEn: "Extra cheese", priceDeltaMinor: 300 },
    { slug: "olives", nameAr: "زيتون", nameEn: "Olives", priceDeltaMinor: 200 },
    { slug: "mushrooms", nameAr: "فطر", nameEn: "Mushrooms", priceDeltaMinor: 250 },
    { slug: "jalapeno", nameAr: "فلفل حار", nameEn: "Jalapeño", priceDeltaMinor: 150 },
    { slug: "extra-chicken", nameAr: "دجاج إضافي", nameEn: "Extra chicken", priceDeltaMinor: 500 },
    { slug: "corn", nameAr: "ذرة", nameEn: "Corn", priceDeltaMinor: 150 },
  ],
};

// The real Pizza House 66 menu, taken from the restaurant's own published
// listing: sixteen items across five sections, at the prices actually charged
// in Yemeni rial. What shipped before was an illustrative placeholder, so the
// owner would have had to retype every line before opening.
const CATALOG: CategorySeed[] = [
  {
    slug: "pizza",
    nameAr: "البيتزا الإيطالية",
    nameEn: "Italian pizza",
    descriptionAr: "عجينة طازجة يوميًا مخبوزة على الحجر",
    descriptionEn: "Dough made fresh daily, stone-baked",
    icon: "pizza",
    products: [
      {
        slug: "supreme",
        nameAr: "بيتزا هاوس سوبريم الخاصة",
        nameEn: "Pizza House Supreme",
        descriptionAr:
          "مزيج متكامل من قطع اللحم والدجاج والببروني، مع الفلفل الرومي، البصل، الزيتون، والمشروم الطازج بجبنة الموزاريلا الغنية.",
        descriptionEn:
          "Beef, chicken and pepperoni with bell pepper, onion, olives and fresh mushrooms under rich mozzarella.",
        imageUrl: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=1000&q=80",
        basePriceMinor: 5500,
        featured: true,
        badge: "bestseller",
        prepMinutes: 20,
        optionGroups: [pizzaSizes(1200, 2400), crustGroup, extrasGroup],
      },
      {
        slug: "chicken-ranch",
        nameAr: "بيتزا دجاج رانش",
        nameEn: "Chicken Ranch",
        descriptionAr:
          "قطع صدور دجاج مشوية بتتبيلتنا الخاصة، صوص الرانش الغني، فطر طازج، وجبنة موزاريلا تعلوها رشة أوريجانو عطرة.",
        descriptionEn:
          "Grilled chicken breast in our own marinade, rich ranch sauce, fresh mushrooms and mozzarella with oregano.",
        imageUrl: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=1000&q=80",
        basePriceMinor: 5000,
        featured: true,
        badge: "bestseller",
        prepMinutes: 20,
        optionGroups: [pizzaSizes(1100, 2200), crustGroup, extrasGroup],
      },
      {
        slug: "bbq-chicken",
        nameAr: "بيتزا دجاج باربكيو",
        nameEn: "BBQ Chicken",
        descriptionAr:
          "دجاج متبل بصلصة الباربكيو المدخنة اللذيذة مع شرائح البصل الأحمر وجبنة الموزاريلا وصوص البيتزا الذهبي.",
        descriptionEn:
          "Chicken in smoky barbecue sauce with red onion, mozzarella and our golden pizza sauce.",
        imageUrl: "https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?w=1000&q=80",
        basePriceMinor: 4800,
        prepMinutes: 20,
        optionGroups: [pizzaSizes(1000, 2100), crustGroup, extrasGroup],
      },
      {
        slug: "pepperoni",
        nameAr: "بيتزا ببروني كلاسيك",
        nameEn: "Classic Pepperoni",
        descriptionAr:
          "شرائح ببروني بقري فاخر مع جبنة موزاريلا ذائبة وصلصة الطماطم الإيطالية الخاصة ببيتزا هاوس على عجينة طازجة.",
        descriptionEn:
          "Prime beef pepperoni, melting mozzarella and our own Italian tomato sauce on fresh dough.",
        imageUrl: "https://images.unsplash.com/photo-1628840042765-356cda07504e?w=1000&q=80",
        basePriceMinor: 4500,
        featured: true,
        prepMinutes: 18,
        optionGroups: [pizzaSizes(1000, 2000), crustGroup, extrasGroup],
      },
      {
        slug: "veggie",
        nameAr: "بيتزا خضار مشكل (فيجي)",
        nameEn: "Mixed Vegetable",
        descriptionAr:
          "تشكيلة غنية من الخضار الطازجة: فلفل حلو ملون، بصل مقرمش، طماطم، زيتون، مشروم، مع صلصة الطماطم وجبنة الموزاريلا.",
        descriptionEn:
          "Sweet peppers, crisp onion, tomato, olives and mushrooms with tomato sauce and mozzarella.",
        imageUrl: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=1000&q=80",
        basePriceMinor: 4000,
        prepMinutes: 18,
        optionGroups: [pizzaSizes(900, 1800), crustGroup, extrasGroup],
      },
      {
        slug: "margherita",
        nameAr: "بيتزا مارجريتا الأصلية",
        nameEn: "Classic Margherita",
        descriptionAr:
          "البساطة الإيطالية الفاخرة: صلصة طماطم متبلة بالأعشاب الطازجة، طبقة وفيرة من جبنة الموزاريلا الفاخرة، وزيت الزيتون البكر.",
        descriptionEn:
          "Italian simplicity: herbed tomato sauce, a generous layer of mozzarella and extra-virgin olive oil.",
        imageUrl: "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=1000&q=80",
        basePriceMinor: 3500,
        prepMinutes: 16,
        optionGroups: [pizzaSizes(800, 1600), crustGroup, extrasGroup],
      },
    ],
  },
  {
    slug: "pastries",
    nameAr: "الفطائر والمعجنات",
    nameEn: "Pastries",
    descriptionAr: "تُخبز في الفترة الصباحية على الحجر",
    descriptionEn: "Stone-baked during the morning service",
    icon: "pizza",
    products: [
      {
        slug: "meat-fatayer",
        nameAr: "فطيرة لحم مفروم بالبهارات",
        nameEn: "Spiced Minced Meat Fatayer",
        descriptionAr:
          "عجينة رقيقة ومحشوة باللحم المفروم الطازج المتبل بالبصل والبهارات الشرقية المميزة.",
        descriptionEn: "Thin dough filled with fresh minced meat, onion and Levantine spices.",
        imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/Sfiha2.jpg/960px-Sfiha2.jpg",
        basePriceMinor: 2200,
        prepMinutes: 12,
      },
      {
        slug: "kraft-honey-fatayer",
        nameAr: "فطيرة جبن كرافت بالعسل",
        nameEn: "Kraft Cheese & Honey Fatayer",
        descriptionAr: "فطيرة ساخنة ومحشوة بجبنة كرافت الأصلية الغنية ومغطاة بأجود أنواع العسل الصافي.",
        descriptionEn: "Hot pastry filled with rich Kraft cheese and finished with pure honey.",
        imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/Fatayer.jpg/960px-Fatayer.jpg",
        basePriceMinor: 2000,
        featured: true,
        prepMinutes: 12,
      },
      {
        slug: "zaatar-labneh",
        nameAr: "فطيرة لبنة وزعتر بلدي",
        nameEn: "Labneh & Wild Za'atar",
        descriptionAr: "لبنة كريمية تركية مع خلطة الزعتر البري وزيت الزيتون على عجينة مخبوزة على الحجر.",
        descriptionEn: "Creamy labneh with wild za'atar and olive oil on stone-baked dough.",
        imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/Zaatar_Mankousheh.jpg/960px-Zaatar_Mankousheh.jpg",
        basePriceMinor: 1800,
        prepMinutes: 12,
      },
    ],
  },
  {
    slug: "sides",
    nameAr: "المقبلات والإضافات",
    nameEn: "Sides",
    descriptionAr: "ما يكمل الوجبة",
    descriptionEn: "What completes the meal",
    icon: "sides",
    products: [
      {
        slug: "mozzarella-sticks",
        nameAr: "أصابع جبنة الموزاريلا المقلية",
        nameEn: "Fried Mozzarella Sticks",
        descriptionAr: "أصابع الموزاريلا الذهبية المقرمشة (5 قطع) تقدم مع صوص المارينارا اللذيذ للتغميس.",
        descriptionEn: "Five golden, crisp mozzarella sticks served with marinara for dipping.",
        imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Fried_Mozzarella_Sticks_at_Millers_Pub_(301456962).jpg/960px-Fried_Mozzarella_Sticks_at_Millers_Pub_(301456962).jpg",
        basePriceMinor: 2200,
        prepMinutes: 10,
      },
      {
        slug: "garlic-bread",
        nameAr: "خبز بالثوم وجبنة الموزاريلا",
        nameEn: "Garlic Bread with Mozzarella",
        descriptionAr:
          "قطع خبز فرنسي مقرمش مدهونة بزبدة الثوم والأعشاب ومغطاة بجبنة الموزاريلا الساخنة الذائبة.",
        descriptionEn: "Crisp French bread with garlic-herb butter under hot melted mozzarella.",
        imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/59/Garlicbread.jpg/960px-Garlicbread.jpg",
        basePriceMinor: 1800,
        prepMinutes: 10,
      },
      {
        slug: "potato-wedges",
        nameAr: "بطاطس ودجز متبلة بالأعشاب",
        nameEn: "Herb Potato Wedges",
        descriptionAr:
          "أصابع بطاطس ودجز مقرمشة ومتبلة بخلطة البابريكا والأعشاب الإيطالية مع صوص الكاتشب أو المايونيز.",
        descriptionEn: "Crisp wedges in paprika and Italian herbs, with ketchup or mayonnaise.",
        imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Potato_wedges_at_Mensa_Paderborn_(11956794164).jpg/960px-Potato_wedges_at_Mensa_Paderborn_(11956794164).jpg",
        basePriceMinor: 1500,
        prepMinutes: 10,
      },
    ],
  },
  {
    slug: "desserts",
    nameAr: "الحلويات",
    nameEn: "Desserts",
    descriptionAr: "تُخبز طازجة عند الطلب",
    descriptionEn: "Baked fresh to order",
    icon: "dessert",
    products: [
      {
        slug: "nutella-banana",
        nameAr: "فطيرة النوتيلا والموز الدافئة",
        nameEn: "Warm Nutella & Banana",
        descriptionAr:
          "عجينة بيتزا طازجة ومحشوة بشوكولاتة النوتيلا الغنية مع شرائح الموز والمكسرات المحمصة.",
        descriptionEn: "Fresh pizza dough filled with Nutella, banana slices and toasted nuts.",
        imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/Nutella_Pizza.jpg/960px-Nutella_Pizza.jpg",
        basePriceMinor: 2500,
        featured: true,
        prepMinutes: 12,
      },
    ],
  },
  {
    slug: "drinks",
    nameAr: "المشروبات المنعشة",
    nameEn: "Cold drinks",
    descriptionAr: "مثلجة ومنعشة",
    descriptionEn: "Chilled and refreshing",
    icon: "drink",
    products: [
      {
        slug: "pepsi",
        nameAr: "بيبسي بارد",
        nameEn: "Pepsi",
        descriptionAr: "مشروب بيبسي غازي منعش ومثلج (علبة 330 مل).",
        descriptionEn: "Chilled Pepsi, 330 ml can.",
        imageUrl: "/menu/pepsi.svg",
        basePriceMinor: 700,
        prepMinutes: 1,
      },
      {
        slug: "seven-up",
        nameAr: "سفن آب بارد",
        nameEn: "7UP",
        descriptionAr: "مشروب سفن آب ليمون منعش ومثلج (علبة 330 مل).",
        descriptionEn: "Chilled lemon 7UP, 330 ml can.",
        imageUrl: "/menu/seven-up.svg",
        basePriceMinor: 700,
        prepMinutes: 1,
      },
      {
        slug: "water",
        nameAr: "مياه شرب نقية",
        nameEn: "Bottled Water",
        descriptionAr: "مياه شرب معبأة نقية ومنعشة (500 مل).",
        descriptionEn: "Pure bottled drinking water, 500 ml.",
        imageUrl: "/menu/water.svg",
        basePriceMinor: 400,
        prepMinutes: 1,
      },
    ],
  },
];

async function seedRestaurant() {
  // Facts about the business, taken from the client's own published listing
  // (docs/RESTAURANT_DISCOVERY.md). These are re-applied on every seed: if
  // the phone number in the database disagrees with the one on the shopfront,
  // the shopfront is right.
  const identity = {
    name: "Pizza House 66",
    nameAr: "بيتزا هاوس 66",
    taglineAr: "اطلب مسبقًا، واستلم في وقتك",
    taglineEn: "Order ahead, collect on your schedule",
    aboutAr:
      "بيتزا هاوس 66 مطعم في المكلا متخصص في البيتزا المخبوزة عند الطلب. نحضّر العجينة يوميًا ونستخدم مكونات طازجة، والآن يمكنك الطلب مسبقًا واختيار وقت الاستلام الذي يناسبك بدل الانتظار عند الطاولة.",
    aboutEn:
      "Pizza House 66 is a restaurant in Al Mukalla specializing in pizza baked to order. We make our dough daily and use fresh ingredients — and now you can order ahead and choose the pickup time that suits you instead of waiting at the counter.",
    currency: "YER",
    timezone: "Asia/Aden",
    phone: "05375561",
    whatsapp: "+967772207788",
    addressAr: "حضرموت، المكلا، فوه، حي المساكن — بالقرب من مستوصف النور وجامعة الأحقاف ومدرسة السلال",
    addressEn:
      "Hadhramaut, Al Mukalla, Fuwah, Al Masakin district — near Al Nour clinic, Al Ahgaff University and Al Sallal school",
    city: "Al Mukalla",
    mapUrl: "https://maps.google.com/?q=Pizza+House+66+Al+Mukalla",
    instagramUrl: "https://www.instagram.com/pizza_house66/",
    // The client collects transfers through Yemen's local wallets rather than
    // a bank IBAN, so the "bank" fields carry the wallet names and the number
    // customers already send to.
    bankNameAr: "محافظ كريمي / العمقي / البسيري",
    bankNameEn: "Kuraimi / Al-Omqi / Al-Basiri wallets",
    bankAccount: "772207788",
    bankHolderAr: "بيتزا هاوس 66",
    bankHolderEn: "Pizza House 66",
    seoTitleAr: "بيتزا هاوس 66 المكلا | اطلب بيتزا أونلاين واستلم في وقتك",
    seoTitleEn: "Pizza House 66 Al Mukalla | Order pizza online for pickup",
    seoDescriptionAr:
      "اطلب بيتزا طازجة من بيتزا هاوس 66 في المكلا. تصفح القائمة، خصص طلبك، واختر وقت الاستلام المناسب لك.",
    seoDescriptionEn:
      "Order fresh pizza from Pizza House 66 in Al Mukalla. Browse the menu, customize your order, and choose a pickup time that works for you.",
  };

  // Operating knobs the manager tunes from the dashboard. Seeded once, then
  // left alone — re-seeding must not quietly undo an evening's decision to
  // pause ordering or widen a slot.
  const operatingDefaults = {
    defaultPrepMinutes: 20,
    slotIntervalMinutes: 15,
    slotCapacity: 10,
    maxScheduleDaysAhead: 3,
    minOrderMinor: 0,
    onlineOrderingPaused: false,
    pauseMessageAr: "الطلب عبر الإنترنت متوقف مؤقتًا بسبب ضغط الطلبات. نعتذر، ونرحب بكم في المطعم.",
    pauseMessageEn:
      "Online ordering is paused for a short while because the kitchen is at capacity. Sorry — you're still very welcome in the restaurant.",
  };

  const restaurant = await prisma.restaurant.upsert({
    where: { slug: RESTAURANT_SLUG },
    create: { slug: RESTAURANT_SLUG, ...identity, ...operatingDefaults },
    update: identity,
  });

  // The kitchen runs two services a day, not one long one: a morning shift and
  // an evening shift, with the kitchen shut in between. Friday has no morning
  // service at all — that is an absent row, not a row marked closed, so the
  // scheduler never offers a slot inside a gap. See src/lib/scheduling.ts.
  const MORNING = { opensAt: "08:00", closesAt: "12:00" };
  const EVENING = { opensAt: "16:00", closesAt: "23:30" };
  const FRIDAY = 5;

  const hours = Array.from({ length: 7 }, (_, dayOfWeek) =>
    dayOfWeek === FRIDAY ? [EVENING] : [MORNING, EVENING]
  ).flatMap((sessions, dayOfWeek) =>
    sessions.map((session) => ({
      restaurantId: restaurant.id,
      dayOfWeek,
      opensAt: session.opensAt,
      closesAt: session.closesAt,
      closed: false,
    }))
  );

  await prisma.$transaction([
    prisma.businessHour.deleteMany({ where: { restaurantId: restaurant.id } }),
    prisma.businessHour.createMany({ data: hours }),
  ]);

  const methods = [
    {
      type: "PAY_AT_PICKUP" as const,
      enabled: true,
      sortOrder: 0,
      instructionsAr: "ادفع نقدًا عند استلام طلبك من المطعم.",
      instructionsEn: "Pay in cash when you collect your order.",
    },
    {
      type: "BANK_TRANSFER" as const,
      enabled: true,
      sortOrder: 1,
      instructionsAr: "حوّل قيمة الطلب إلى الحساب الموضح، ثم أرفق صورة الإيصال ورقم العملية.",
      instructionsEn: "Transfer the order total to the account shown, then attach the receipt image and reference number.",
    },
    {
      // Off until a real provider is integrated — the abstraction exists, the
      // integration does not, and pretending otherwise would be worse than
      // leaving it visibly disabled (docs/PRD.md §22).
      type: "ELECTRONIC" as const,
      enabled: false,
      sortOrder: 2,
      instructionsAr: "الدفع الإلكتروني غير مفعّل حاليًا.",
      instructionsEn: "Online payment is not enabled yet.",
    },
  ];
  for (const method of methods) {
    await prisma.paymentMethodConfig.upsert({
      where: { restaurantId_type: { restaurantId: restaurant.id, type: method.type } },
      create: { restaurantId: restaurant.id, ...method },
      update: { instructionsAr: method.instructionsAr, instructionsEn: method.instructionsEn },
    });
  }

  return restaurant;
}

async function seedCatalog() {
  // Anything left over from an earlier catalogue is hidden rather than
  // deleted: past orders point at those rows, so removing them would take
  // the order history with them. Hidden keeps the receipt readable and the
  // menu honest.
  const liveCategorySlugs = CATALOG.map((category) => category.slug);
  const liveProductSlugs = CATALOG.flatMap((category) =>
    category.products.map((product) => product.slug)
  );
  await prisma.product.updateMany({
    where: { slug: { notIn: liveProductSlugs }, availability: { not: "HIDDEN" } },
    data: { availability: "HIDDEN", featured: false },
  });
  await prisma.category.updateMany({
    where: { slug: { notIn: liveCategorySlugs }, active: true },
    data: { active: false },
  });

  for (const [categoryIndex, category] of CATALOG.entries()) {
    const categoryRow = await prisma.category.upsert({
      where: { slug: category.slug },
      create: {
        slug: category.slug,
        nameAr: category.nameAr,
        nameEn: category.nameEn,
        descriptionAr: category.descriptionAr,
        descriptionEn: category.descriptionEn,
        icon: category.icon,
        sortOrder: categoryIndex,
        active: true,
      },
      update: {
        nameAr: category.nameAr,
        nameEn: category.nameEn,
        descriptionAr: category.descriptionAr,
        descriptionEn: category.descriptionEn,
        icon: category.icon,
        sortOrder: categoryIndex,
      },
    });

    for (const [productIndex, product] of category.products.entries()) {
      const productRow = await prisma.product.upsert({
        where: { slug: product.slug },
        create: {
          slug: product.slug,
          categoryId: categoryRow.id,
          nameAr: product.nameAr,
          nameEn: product.nameEn,
          descriptionAr: product.descriptionAr,
          descriptionEn: product.descriptionEn,
          imageUrl: product.imageUrl,
          basePriceMinor: product.basePriceMinor,
          availability: product.availability ?? "AVAILABLE",
          featured: product.featured ?? false,
          badge: product.badge,
          sortOrder: productIndex,
          prepMinutes: product.prepMinutes,
        },
        update: {
          categoryId: categoryRow.id,
          nameAr: product.nameAr,
          nameEn: product.nameEn,
          descriptionAr: product.descriptionAr,
          descriptionEn: product.descriptionEn,
          imageUrl: product.imageUrl,
          basePriceMinor: product.basePriceMinor,
          featured: product.featured ?? false,
          badge: product.badge,
          sortOrder: productIndex,
          prepMinutes: product.prepMinutes,
        },
      });

      for (const [groupIndex, group] of (product.optionGroups ?? []).entries()) {
        // Option groups have no natural unique key across products, so they
        // are matched by (product, English name) and replaced wholesale.
        const existing = await prisma.productOptionGroup.findFirst({
          where: { productId: productRow.id, nameEn: group.nameEn },
        });
        const groupRow = existing
          ? await prisma.productOptionGroup.update({
              where: { id: existing.id },
              data: {
                nameAr: group.nameAr,
                required: group.required ?? false,
                multiSelect: group.multiSelect ?? false,
                maxSelect: group.maxSelect ?? null,
                sortOrder: groupIndex,
              },
            })
          : await prisma.productOptionGroup.create({
              data: {
                productId: productRow.id,
                nameAr: group.nameAr,
                nameEn: group.nameEn,
                required: group.required ?? false,
                multiSelect: group.multiSelect ?? false,
                maxSelect: group.maxSelect ?? null,
                sortOrder: groupIndex,
              },
            });

        for (const [valueIndex, value] of group.values.entries()) {
          const existingValue = await prisma.productOptionValue.findFirst({
            where: { groupId: groupRow.id, nameEn: value.nameEn },
          });
          if (existingValue) {
            await prisma.productOptionValue.update({
              where: { id: existingValue.id },
              data: {
                nameAr: value.nameAr,
                priceDeltaMinor: value.priceDeltaMinor ?? 0,
                sortOrder: valueIndex,
              },
            });
          } else {
            await prisma.productOptionValue.create({
              data: {
                groupId: groupRow.id,
                nameAr: value.nameAr,
                nameEn: value.nameEn,
                priceDeltaMinor: value.priceDeltaMinor ?? 0,
                sortOrder: valueIndex,
              },
            });
          }
        }
      }
    }
  }
}

async function seedPromotions() {
  // Three public offers and one reward template. The public ones exist to be
  // *advertised* — they are the reason the offers page has anything on it —
  // and each answers a different question the owner has about their trade:
  //
  //   WELCOME    turns a first visit into a first order. Capped at one per
  //              phone number, because its whole value is the first time.
  //   FAMILY10   raises the average basket. It pays nothing below 5,000 and
  //              is capped at 1,500, so the discount can never outrun the
  //              extra the customer had to spend to earn it.
  //   MORNING    fills the 08:00-12:00 service, which is the quiet one. A
  //              fixed 300 off pastries costs little and moves demand out of
  //              the evening rush the kitchen is already struggling with.
  //
  // The fourth is never advertised and its code never works: LOYALTY-REWARD
  // is the template each earned coupon is issued from (src/lib/loyalty.ts).
  const offers = [
    {
      code: "WELCOME",
      nameAr: "ترحيب بأول طلب",
      nameEn: "Welcome — your first order",
      descriptionAr: "خصم ١٠٪ على أول طلب لك من بيتزا هاوس 66، حتى ١٬٠٠٠ ريال.",
      descriptionEn: "10% off your first order with Pizza House 66, up to 1,000 YER.",
      discountType: "PERCENTAGE" as const,
      discountValue: 10,
      minOrderMinor: 2000,
      maxDiscountMinor: 1000,
      perCustomerLimit: 1,
      visibility: "PUBLIC" as const,
      sortOrder: 0,
    },
    {
      code: "FAMILY10",
      nameAr: "خصم العائلة ١٠٪",
      nameEn: "Family deal — 10% off",
      descriptionAr: "خصم ١٠٪ على الطلبات التي تتجاوز ٥٬٠٠٠ ريال، حتى ١٬٥٠٠ ريال.",
      descriptionEn: "10% off orders over 5,000 YER, up to 1,500 YER.",
      discountType: "PERCENTAGE" as const,
      discountValue: 10,
      minOrderMinor: 5000,
      maxDiscountMinor: 1500,
      perCustomerLimit: null,
      visibility: "PUBLIC" as const,
      sortOrder: 1,
    },
    {
      code: "MORNING",
      nameAr: "فطور بيتزا هاوس",
      nameEn: "Pizza House breakfast",
      descriptionAr: "خصم ٣٠٠ ريال على الفطائر والمعجنات في الفترة الصباحية.",
      descriptionEn: "300 YER off pastries during the morning service.",
      discountType: "FIXED" as const,
      discountValue: 300,
      minOrderMinor: 1500,
      maxDiscountMinor: null,
      perCustomerLimit: null,
      visibility: "PUBLIC" as const,
      sortOrder: 2,
    },
    {
      code: LOYALTY_PROMOTION_CODE,
      nameAr: "مكافأة الوفاء",
      nameEn: "Loyalty reward",
      descriptionAr: "خصم ١٬٠٠٠ ريال، هديّة لك بعد كل خمسة طلبات مكتملة.",
      descriptionEn: "1,000 YER off, yours after every five completed orders.",
      discountType: "FIXED" as const,
      discountValue: 1000,
      minOrderMinor: 2500,
      maxDiscountMinor: null,
      perCustomerLimit: null,
      visibility: "EARNED" as const,
      sortOrder: 9,
    },
  ];

  const created: Record<string, string> = {};
  for (const offer of offers) {
    const row = await prisma.promotion.upsert({
      where: { code: offer.code },
      create: { ...offer, active: true },
      // The wording, the amounts and the visibility are refreshed; the usage
      // counter is the restaurant's own trading record and is never reset.
      update: {
        nameAr: offer.nameAr,
        nameEn: offer.nameEn,
        descriptionAr: offer.descriptionAr,
        descriptionEn: offer.descriptionEn,
        discountType: offer.discountType,
        discountValue: offer.discountValue,
        minOrderMinor: offer.minOrderMinor,
        maxDiscountMinor: offer.maxDiscountMinor,
        perCustomerLimit: offer.perCustomerLimit,
        visibility: offer.visibility,
        sortOrder: offer.sortOrder,
      },
    });
    created[offer.code] = row.id;
  }

  // The morning offer only applies to what the morning service actually
  // bakes, so it is scoped to those products rather than the whole basket.
  const pastries = await prisma.product.findMany({
    where: { category: { slug: { in: ["pastries", "sides"] } }, availability: { not: "HIDDEN" } },
    select: { id: true },
  });
  await prisma.promotionProduct.createMany({
    data: pastries.map((product) => ({
      promotionId: created.MORNING!,
      productId: product.id,
    })),
    skipDuplicates: true,
  });

  // An offer the seed no longer lists is switched off rather than deleted:
  // orders point at the promotion they were discounted by, and deleting one
  // would rewrite what a customer was actually charged.
  await prisma.promotion.updateMany({
    where: { code: { notIn: offers.map((offer) => offer.code) }, active: true },
    data: { active: false },
  });

  return created;
}

async function seedStaff() {
  const password = process.env.SEED_STAFF_PASSWORD;
  if (!password) {
    if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
      console.warn(
        "\n[seed] SEED_STAFF_PASSWORD is not set — skipping staff accounts.\n" +
          "       Create the first owner account with: npm run staff:create\n"
      );
      return;
    }
    console.warn("[seed] SEED_STAFF_PASSWORD not set; using the development default.");
  }
  if (password && password.length < 8) {
    throw new Error("SEED_STAFF_PASSWORD must be at least 8 characters.");
  }

  const effectivePassword = password ?? "ChangeMe123!";
  const passwordHash = await bcrypt.hash(effectivePassword, 12);

  const staff = [
    { email: "owner@pizzahouse.local", name: "صاحب المطعم", role: "OWNER" as const },
    { email: "manager@pizzahouse.local", name: "مدير المطعم", role: "MANAGER" as const },
    { email: "cashier@pizzahouse.local", name: "الكاشير", role: "CASHIER" as const },
    { email: "kitchen@pizzahouse.local", name: "المطبخ", role: "KITCHEN" as const },
  ];

  for (const member of staff) {
    await prisma.user.upsert({
      where: { email: member.email },
      create: { ...member, passwordHash, active: true },
      // Never silently reset an existing account's password on reseed.
      update: { name: member.name, role: member.role },
    });
  }

  console.log(
    `[seed] Staff accounts ready: ${staff.map((s) => s.email).join(", ")}\n` +
      `[seed] Password: ${password ? "(from SEED_STAFF_PASSWORD)" : effectivePassword}`
  );
}

async function main() {
  // `SEED_ONLY_IF_EMPTY` makes this safe to run on every boot of a deployed
  // container, which is how a fresh environment gets its first Restaurant row
  // without anyone opening a shell.
  //
  // The guard matters because the seed upserts: run unconditionally against a
  // live restaurant, it would rewrite every price and description the owner
  // had edited back to the demo values on each redeploy. Seeding a database
  // that already has a restaurant in it is never what anyone wants.
  if (process.env.SEED_ONLY_IF_EMPTY === "1") {
    const existing = await prisma.restaurant.count();
    if (existing > 0) {
      console.log("[seed] Restaurant already configured — skipping (SEED_ONLY_IF_EMPTY=1).");
      return;
    }
    console.log("[seed] Empty database — seeding initial data.");
  }

  console.log("[seed] Seeding Pizza House 66 data…");
  await seedRestaurant();
  await seedCatalog();
  await seedPromotions();
  await seedStaff();

  // Counted as the menu counts them — hidden leftovers from an earlier
  // catalogue are still rows, but they are not the menu.
  const counts = await Promise.all([
    prisma.category.count({ where: { active: true } }),
    prisma.product.count({ where: { availability: { not: "HIDDEN" } } }),
    prisma.promotion.count(),
    prisma.user.count(),
  ] as PrismaPromise<number>[]);
  console.log(
    `[seed] Done — ${counts[0]} categories, ${counts[1]} products, ${counts[2]} promotions, ${counts[3]} staff accounts.`
  );
  console.log("[seed] The menu, hours and contact details are the real ones.");
  console.log("[seed] Still to confirm before launch: see docs/ASSUMPTIONS.md.");
}

main()
  .catch((error) => {
    console.error("[seed] Failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
