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

const drinkSize: OptionGroupSeed = {
  slug: "drink-size",
  nameAr: "الحجم",
  nameEn: "Size",
  required: true,
  values: [
    { slug: "regular", nameAr: "عادي", nameEn: "Regular", priceDeltaMinor: 0 },
    { slug: "large", nameAr: "كبير", nameEn: "Large", priceDeltaMinor: 200 },
  ],
};

const CATALOG: CategorySeed[] = [
  {
    slug: "pizza",
    nameAr: "البيتزا",
    nameEn: "Pizza",
    descriptionAr: "عجينة تُحضّر يوميًا وتُخبز عند الطلب",
    descriptionEn: "Dough made fresh daily, baked to order",
    icon: "pizza",
    products: [
      {
        slug: "margherita",
        nameAr: "مارغريتا",
        nameEn: "Margherita",
        descriptionAr: "صلصة طماطم، موزاريلا، ريحان طازج، زيت زيتون",
        descriptionEn: "Tomato sauce, mozzarella, fresh basil, olive oil",
        imageUrl: "/menu/pizza-margherita.svg",
        basePriceMinor: 2200,
        featured: true,
        badge: "bestseller",
        prepMinutes: 18,
        optionGroups: [pizzaSizes(700, 1400), crustGroup, extrasGroup],
      },
      {
        slug: "pepperoni",
        nameAr: "بيبروني",
        nameEn: "Pepperoni",
        descriptionAr: "شرائح بيبروني، موزاريلا، صلصة طماطم",
        descriptionEn: "Pepperoni slices, mozzarella, tomato sauce",
        imageUrl: "/menu/pizza-pepperoni.svg",
        basePriceMinor: 2500,
        featured: true,
        badge: "bestseller",
        prepMinutes: 20,
        optionGroups: [pizzaSizes(800, 1500), crustGroup, extrasGroup],
      },
      {
        slug: "chicken-ranch",
        nameAr: "دجاج رانش",
        nameEn: "Chicken Ranch",
        descriptionAr: "قطع دجاج مشوي، صلصة رانش، بصل، موزاريلا",
        descriptionEn: "Grilled chicken, ranch sauce, onion, mozzarella",
        imageUrl: "/menu/pizza-chicken-ranch.svg",
        basePriceMinor: 2800,
        featured: true,
        prepMinutes: 22,
        optionGroups: [pizzaSizes(800, 1600), crustGroup, extrasGroup],
      },
      {
        slug: "veggie",
        nameAr: "خضار",
        nameEn: "Veggie",
        descriptionAr: "فلفل ملوّن، زيتون، فطر، بصل، ذرة",
        descriptionEn: "Bell peppers, olives, mushrooms, onion, corn",
        imageUrl: "/menu/pizza-veggie.svg",
        basePriceMinor: 2400,
        prepMinutes: 20,
        optionGroups: [pizzaSizes(700, 1400), crustGroup, extrasGroup],
      },
      {
        slug: "four-cheese",
        nameAr: "أربعة أجبان",
        nameEn: "Four Cheese",
        descriptionAr: "موزاريلا، شيدر، بارميزان، جبن كريمي",
        descriptionEn: "Mozzarella, cheddar, parmesan, cream cheese",
        imageUrl: "/menu/pizza-four-cheese.svg",
        basePriceMinor: 2900,
        prepMinutes: 20,
        optionGroups: [pizzaSizes(800, 1600), crustGroup, extrasGroup],
      },
      {
        slug: "spicy-beef",
        nameAr: "لحم حار",
        nameEn: "Spicy Beef",
        descriptionAr: "لحم مفروم متبّل، فلفل حار، بصل، موزاريلا",
        descriptionEn: "Seasoned minced beef, chilli, onion, mozzarella",
        imageUrl: "/menu/pizza-spicy-beef.svg",
        basePriceMinor: 3000,
        badge: "spicy",
        prepMinutes: 22,
        optionGroups: [pizzaSizes(900, 1700), crustGroup, extrasGroup],
      },
      {
        slug: "house-special",
        nameAr: "بيتزا البيت",
        nameEn: "House Special",
        descriptionAr: "بيبروني، لحم، فطر، فلفل، زيتون — كل ما نحبه في بيتزا واحدة",
        descriptionEn: "Pepperoni, beef, mushrooms, peppers, olives — everything we love on one pizza",
        imageUrl: "/menu/pizza-special.svg",
        basePriceMinor: 3400,
        featured: true,
        badge: "featured",
        prepMinutes: 25,
        optionGroups: [pizzaSizes(900, 1800), crustGroup, extrasGroup],
      },
    ],
  },
  {
    slug: "sides",
    nameAr: "المقبلات",
    nameEn: "Sides",
    descriptionAr: "ما يكمل الوجبة",
    descriptionEn: "What rounds out the meal",
    icon: "sides",
    products: [
      {
        slug: "calzone",
        nameAr: "كالزوني",
        nameEn: "Calzone",
        descriptionAr: "عجينة مطوية محشوة بالجبن واللحم",
        descriptionEn: "Folded dough stuffed with cheese and beef",
        imageUrl: "/menu/calzone.svg",
        basePriceMinor: 2000,
        prepMinutes: 18,
        optionGroups: [
          {
            slug: "calzone-filling",
            nameAr: "الحشوة",
            nameEn: "Filling",
            required: true,
            values: [
              { slug: "cheese", nameAr: "جبن", nameEn: "Cheese", priceDeltaMinor: 0 },
              { slug: "beef", nameAr: "لحم", nameEn: "Beef", priceDeltaMinor: 400 },
              { slug: "chicken", nameAr: "دجاج", nameEn: "Chicken", priceDeltaMinor: 350 },
            ],
          },
        ],
      },
      {
        slug: "chicken-burger",
        nameAr: "برجر دجاج",
        nameEn: "Chicken Burger",
        descriptionAr: "صدر دجاج مقرمش، خس، طماطم، صلصة المطعم",
        descriptionEn: "Crispy chicken breast, lettuce, tomato, house sauce",
        imageUrl: "/menu/burger.svg",
        basePriceMinor: 1800,
        prepMinutes: 12,
        optionGroups: [
          {
            slug: "burger-extras",
            nameAr: "إضافات",
            nameEn: "Extras",
            multiSelect: true,
            maxSelect: 3,
            values: [
              { slug: "cheese-slice", nameAr: "شريحة جبن", nameEn: "Cheese slice", priceDeltaMinor: 200 },
              { slug: "spicy-sauce", nameAr: "صلصة حارة", nameEn: "Spicy sauce", priceDeltaMinor: 100 },
              { slug: "double-patty", nameAr: "قطعة إضافية", nameEn: "Double patty", priceDeltaMinor: 700 },
            ],
          },
        ],
      },
      {
        slug: "fries",
        nameAr: "بطاطس مقلية",
        nameEn: "French Fries",
        descriptionAr: "بطاطس مقرمشة مع توابل المطعم",
        descriptionEn: "Crispy fries with house seasoning",
        imageUrl: "/menu/fries.svg",
        basePriceMinor: 800,
        badge: "value",
        prepMinutes: 8,
        optionGroups: [
          {
            slug: "fries-size",
            nameAr: "الحجم",
            nameEn: "Size",
            required: true,
            values: [
              { slug: "regular", nameAr: "عادي", nameEn: "Regular", priceDeltaMinor: 0 },
              { slug: "large", nameAr: "كبير", nameEn: "Large", priceDeltaMinor: 300 },
            ],
          },
        ],
      },
      {
        slug: "garden-salad",
        nameAr: "سلطة خضراء",
        nameEn: "Garden Salad",
        descriptionAr: "خس، طماطم، خيار، صلصة ليمون وزيت زيتون",
        descriptionEn: "Lettuce, tomato, cucumber, lemon and olive oil dressing",
        imageUrl: "/menu/salad.svg",
        basePriceMinor: 900,
        prepMinutes: 5,
      },
    ],
  },
  {
    slug: "drinks",
    nameAr: "المشروبات",
    nameEn: "Drinks",
    descriptionAr: "بارد ومنعش",
    descriptionEn: "Cold and refreshing",
    icon: "drinks",
    products: [
      {
        slug: "cola",
        nameAr: "كولا",
        nameEn: "Cola",
        descriptionAr: "مشروب غازي بارد",
        descriptionEn: "Chilled soft drink",
        imageUrl: "/menu/cola.svg",
        basePriceMinor: 400,
        prepMinutes: 2,
        optionGroups: [drinkSize],
      },
      {
        slug: "orange-juice",
        nameAr: "عصير برتقال",
        nameEn: "Orange Juice",
        descriptionAr: "برتقال طازج يُعصر عند الطلب",
        descriptionEn: "Fresh oranges, squeezed to order",
        imageUrl: "/menu/orange-juice.svg",
        basePriceMinor: 700,
        featured: true,
        prepMinutes: 5,
        optionGroups: [drinkSize],
      },
      {
        slug: "mint-lemonade",
        nameAr: "ليمون بالنعناع",
        nameEn: "Mint Lemonade",
        descriptionAr: "ليمون طازج مع نعناع ومثلج",
        descriptionEn: "Fresh lemon with mint, served iced",
        imageUrl: "/menu/mojito.svg",
        basePriceMinor: 800,
        badge: "new",
        prepMinutes: 5,
        optionGroups: [drinkSize],
      },
      {
        slug: "water",
        nameAr: "مياه",
        nameEn: "Bottled Water",
        descriptionAr: "قارورة مياه ٦٠٠ مل",
        descriptionEn: "600ml bottle",
        imageUrl: "/menu/water.svg",
        basePriceMinor: 200,
        prepMinutes: 1,
      },
    ],
  },
  {
    slug: "desserts",
    nameAr: "الحلويات",
    nameEn: "Desserts",
    descriptionAr: "نهاية حلوة للوجبة",
    descriptionEn: "A sweet finish",
    icon: "desserts",
    products: [
      {
        slug: "chocolate-cake",
        nameAr: "كيكة شوكولاتة",
        nameEn: "Chocolate Cake",
        descriptionAr: "قطعة كيكة شوكولاتة غنية",
        descriptionEn: "A rich slice of chocolate cake",
        imageUrl: "/menu/chocolate-cake.svg",
        basePriceMinor: 1000,
        prepMinutes: 3,
      },
      {
        slug: "cheesecake",
        nameAr: "تشيز كيك",
        nameEn: "Cheesecake",
        descriptionAr: "تشيز كيك بصلصة التوت",
        descriptionEn: "Cheesecake with berry sauce",
        imageUrl: "/menu/cheesecake.svg",
        basePriceMinor: 1200,
        featured: true,
        prepMinutes: 3,
      },
      {
        slug: "tiramisu",
        nameAr: "تيراميسو",
        nameEn: "Tiramisu",
        descriptionAr: "طبقات قهوة وكريمة",
        descriptionEn: "Layers of coffee and cream",
        imageUrl: "/menu/tiramisu.svg",
        basePriceMinor: 1300,
        // Demonstrates the sold-out state on a real screen rather than in docs.
        availability: "SOLD_OUT",
        prepMinutes: 3,
      },
    ],
  },
];

async function seedRestaurant() {
  const restaurant = await prisma.restaurant.upsert({
    where: { slug: RESTAURANT_SLUG },
    create: {
      slug: RESTAURANT_SLUG,
      name: "Pizza House",
      nameAr: "بيتزا هاوس",
      taglineAr: "اطلب مسبقًا، واستلم في وقتك",
      taglineEn: "Order ahead, collect on your schedule",
      aboutAr:
        "بيتزا هاوس مطعم في المكلا متخصص في البيتزا المخبوزة عند الطلب. نحضّر العجينة يوميًا ونستخدم مكونات طازجة، والآن يمكنك الطلب مسبقًا واختيار وقت الاستلام الذي يناسبك بدل الانتظار عند الطاولة.",
      aboutEn:
        "Pizza House is a restaurant in Al Mukalla specializing in pizza baked to order. We make our dough daily and use fresh ingredients — and now you can order ahead and choose the pickup time that suits you instead of waiting at the counter.",
      currency: "YER",
      timezone: "Asia/Aden",
      phone: "+967 5 300000",
      whatsapp: "+967 700000000",
      email: "hello@pizzahouse.example",
      addressAr: "شارع الرئيسي، المكلا، حضرموت",
      addressEn: "Main Street, Al Mukalla, Hadhramaut",
      city: "Al Mukalla",
      mapUrl: "https://maps.google.com/?q=Al+Mukalla",
      defaultPrepMinutes: 20,
      slotIntervalMinutes: 15,
      slotCapacity: 10,
      maxScheduleDaysAhead: 3,
      minOrderMinor: 0,
      onlineOrderingPaused: false,
      pauseMessageAr: "الطلب عبر الإنترنت متوقف مؤقتًا بسبب ضغط الطلبات. نعتذر، ونرحب بكم في المطعم.",
      pauseMessageEn:
        "Online ordering is paused for a short while because the kitchen is at capacity. Sorry — you're still very welcome in the restaurant.",
      bankNameAr: "بنك المثال",
      bankNameEn: "Example Bank",
      bankAccount: "0000-000000-000",
      bankHolderAr: "مطعم بيتزا هاوس",
      bankHolderEn: "Pizza House Restaurant",
      seoTitleAr: "بيتزا هاوس المكلا | اطلب بيتزا أونلاين واستلم في وقتك",
      seoTitleEn: "Pizza House Al Mukalla | Order pizza online for pickup",
      seoDescriptionAr:
        "اطلب بيتزا طازجة من بيتزا هاوس في المكلا. تصفح القائمة، خصص طلبك، واختر وقت الاستلام المناسب لك.",
      seoDescriptionEn:
        "Order fresh pizza from Pizza House in Al Mukalla. Browse the menu, customize your order, and choose a pickup time that works for you.",
    },
    update: {},
  });

  // 16:00–00:00 every day (docs/ASSUMPTIONS.md — real hours must be confirmed).
  for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
    await prisma.businessHour.upsert({
      where: { restaurantId_dayOfWeek: { restaurantId: restaurant.id, dayOfWeek } },
      create: { restaurantId: restaurant.id, dayOfWeek, opensAt: "16:00", closesAt: "00:00", closed: false },
      update: {},
    });
  }

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
  const pizzaProducts = await prisma.product.findMany({
    where: { category: { slug: "pizza" } },
    select: { id: true },
  });

  const familyDeal = await prisma.promotion.upsert({
    where: { code: "FAMILY10" },
    create: {
      code: "FAMILY10",
      nameAr: "خصم العائلة ١٠٪",
      nameEn: "Family deal — 10% off",
      descriptionAr: "خصم ١٠٪ على الطلبات التي تتجاوز ٥٬٠٠٠ ريال.",
      descriptionEn: "10% off orders over 5,000 YER.",
      discountType: "PERCENTAGE",
      discountValue: 10,
      minOrderMinor: 5000,
      maxDiscountMinor: 1500,
      active: true,
    },
    update: {},
  });

  const pizzaTuesday = await prisma.promotion.upsert({
    where: { code: "PIZZA500" },
    create: {
      code: "PIZZA500",
      nameAr: "وفّر ٥٠٠ على البيتزا",
      nameEn: "500 off any pizza",
      descriptionAr: "خصم ٥٠٠ ريال على أي بيتزا عند الطلب المسبق.",
      descriptionEn: "500 YER off any pizza when you order ahead.",
      discountType: "FIXED",
      discountValue: 500,
      minOrderMinor: 2000,
      active: true,
    },
    update: {},
  });

  await prisma.promotionProduct.createMany({
    data: pizzaProducts.map((product) => ({ promotionId: pizzaTuesday.id, productId: product.id })),
    skipDuplicates: true,
  });

  return { familyDeal, pizzaTuesday };
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
  console.log("[seed] Seeding Pizza House demo data…");
  await seedRestaurant();
  await seedCatalog();
  await seedPromotions();
  await seedStaff();

  const counts = await Promise.all([
    prisma.category.count(),
    prisma.product.count(),
    prisma.promotion.count(),
    prisma.user.count(),
  ] as PrismaPromise<number>[]);
  console.log(
    `[seed] Done — ${counts[0]} categories, ${counts[1]} products, ${counts[2]} promotions, ${counts[3]} staff accounts.`
  );
  console.log("[seed] Reminder: this menu is illustrative. See docs/ASSUMPTIONS.md before launch.");
}

main()
  .catch((error) => {
    console.error("[seed] Failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
