/**
 * Demo/dev seed data for Pizza House (Al Mukalla, Yemen).
 *
 * IMPORTANT — read docs/RESTAURANT_DISCOVERY.md before treating any of this
 * as fact. Only the restaurant's existence, name, city/district, and
 * Instagram handle were verifiable (docs/RESTAURANT_DISCOVERY.md). Every
 * price, product, business hour, and payment detail below is an ASSUMPTION
 * for demo purposes and is marked as such — it must be replaced with real
 * data from the restaurant owner before any production launch.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const restaurant = await prisma.restaurant.upsert({
    where: { slug: "pizza-house-mukalla" },
    update: {},
    create: {
      slug: "pizza-house-mukalla",
      name: "Pizza House",
      nameAr: "بيتزا هاوس",
      currency: "YER",
      phone: "ASSUMPTION — confirm with owner",
      whatsapp: "ASSUMPTION — confirm with owner",
      addressAr: "حي فوة، المكلا، اليمن (ASSUMPTION)",
      addressEn: "Fawah district, Al Mukalla, Yemen (ASSUMPTION)",
      city: "Al Mukalla",
      instagramUrl: "https://www.instagram.com/pizza_house66/",
      defaultPrepMinutes: 20,
      slotIntervalMinutes: 15,
      slotCapacity: 10,
      onlineOrderingPaused: false,
      pauseMessageAr: "الطلب عبر الإنترنت متوقف مؤقتًا. يرجى المحاولة لاحقًا.",
      pauseMessageEn: "Online ordering is temporarily unavailable. Please try again later.",
    },
  });

  // ASSUMPTION: 16:00–00:00 daily, matching the illustrative hours in the PRD.
  // Must be confirmed with the owner (docs/ASSUMPTIONS.md).
  for (let day = 0; day <= 6; day++) {
    await prisma.businessHour.upsert({
      where: { restaurantId_dayOfWeek: { restaurantId: restaurant.id, dayOfWeek: day } },
      update: {},
      create: {
        restaurantId: restaurant.id,
        dayOfWeek: day,
        opensAt: "16:00",
        closesAt: "00:00",
        closed: false,
      },
    });
  }

  await prisma.paymentMethodConfig.upsert({
    where: { restaurantId_type: { restaurantId: restaurant.id, type: "PAY_AT_PICKUP" } },
    update: {},
    create: { restaurantId: restaurant.id, type: "PAY_AT_PICKUP", enabled: true },
  });
  await prisma.paymentMethodConfig.upsert({
    where: { restaurantId_type: { restaurantId: restaurant.id, type: "BANK_TRANSFER" } },
    update: {},
    create: {
      restaurantId: restaurant.id,
      type: "BANK_TRANSFER",
      enabled: true,
      instructionsAr: "حوّل المبلغ إلى الحساب المعتمد وأدخل رقم المرجع أدناه (ASSUMPTION).",
      instructionsEn: "Transfer to the approved account and enter the reference number below (ASSUMPTION).",
    },
  });
  await prisma.paymentMethodConfig.upsert({
    where: { restaurantId_type: { restaurantId: restaurant.id, type: "ELECTRONIC" } },
    update: {},
    create: { restaurantId: restaurant.id, type: "ELECTRONIC", enabled: false },
  });

  const pizzaCategory = await prisma.category.upsert({
    where: { slug: "pizza" },
    update: {},
    create: { slug: "pizza", nameAr: "بيتزا", nameEn: "Pizza", sortOrder: 1 },
  });
  const drinksCategory = await prisma.category.upsert({
    where: { slug: "drinks" },
    update: {},
    create: { slug: "drinks", nameAr: "مشروبات", nameEn: "Drinks", sortOrder: 2 },
  });
  const dessertsCategory = await prisma.category.upsert({
    where: { slug: "desserts" },
    update: {},
    create: { slug: "desserts", nameAr: "حلى", nameEn: "Desserts", sortOrder: 3 },
  });

  // ASSUMPTION: product names are common pizza-restaurant offerings, not
  // confirmed against the real Pizza House menu (Instagram content was not
  // accessible from this environment — see docs/RESTAURANT_DISCOVERY.md).
  // ASSUMPTION: all prices are illustrative placeholders in YER.
  const pizzas: {
    slug: string;
    nameAr: string;
    nameEn: string;
    descAr: string;
    descEn: string;
    basePriceMinor: number;
    featured?: boolean;
  }[] = [
    {
      slug: "margherita",
      nameAr: "مارغريتا",
      nameEn: "Margherita",
      descAr: "صلصة طماطم، جبنة موزاريلا، ريحان",
      descEn: "Tomato sauce, mozzarella, basil",
      basePriceMinor: 2000,
      featured: true,
    },
    {
      slug: "pepperoni",
      nameAr: "بيبروني",
      nameEn: "Pepperoni",
      descAr: "صلصة طماطم، جبنة موزاريلا، بيبروني",
      descEn: "Tomato sauce, mozzarella, pepperoni",
      basePriceMinor: 2500,
      featured: true,
    },
    {
      slug: "chicken-supreme",
      nameAr: "دجاج سوبريم",
      nameEn: "Chicken Supreme",
      descAr: "دجاج مشوي، فلفل، بصل، جبنة موزاريلا",
      descEn: "Grilled chicken, peppers, onion, mozzarella",
      basePriceMinor: 2800,
      featured: true,
    },
    {
      slug: "house-special",
      nameAr: "بيتزا هاوس الخاصة",
      nameEn: "Pizza House Special",
      descAr: "مزيج من اللحوم والخضار وجبنة إضافية",
      descEn: "A house blend of meats, vegetables, and extra cheese",
      basePriceMinor: 3200,
    },
  ];

  for (const [i, p] of pizzas.entries()) {
    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: {},
      create: {
        slug: p.slug,
        categoryId: pizzaCategory.id,
        nameAr: p.nameAr,
        nameEn: p.nameEn,
        descriptionAr: p.descAr,
        descriptionEn: p.descEn,
        basePriceMinor: p.basePriceMinor,
        availability: "AVAILABLE",
        featured: p.featured ?? false,
        sortOrder: i,
        prepMinutes: 20,
      },
    });

    const sizeGroup = await prisma.productOptionGroup.create({
      data: {
        productId: product.id,
        nameAr: "الحجم",
        nameEn: "Size",
        required: true,
        multiSelect: false,
        sortOrder: 1,
        values: {
          create: [
            { nameAr: "صغير", nameEn: "Small", priceDeltaMinor: 0, sortOrder: 1 },
            { nameAr: "وسط", nameEn: "Medium", priceDeltaMinor: 500, sortOrder: 2 },
            { nameAr: "كبير", nameEn: "Large", priceDeltaMinor: 1000, sortOrder: 3 },
          ],
        },
      },
    });
    void sizeGroup;

    await prisma.productOptionGroup.create({
      data: {
        productId: product.id,
        nameAr: "إضافات",
        nameEn: "Add-ons",
        required: false,
        multiSelect: true,
        sortOrder: 2,
        values: {
          create: [
            { nameAr: "جبنة إضافية", nameEn: "Extra Cheese", priceDeltaMinor: 300, sortOrder: 1 },
            { nameAr: "زيتون", nameEn: "Olives", priceDeltaMinor: 200, sortOrder: 2 },
            { nameAr: "مشروم", nameEn: "Mushrooms", priceDeltaMinor: 250, sortOrder: 3 },
          ],
        },
      },
    });
  }

  const drinks = [
    { slug: "soft-drink-can", nameAr: "مشروب غازي", nameEn: "Soft Drink (Can)", price: 300 },
    { slug: "water-bottle", nameAr: "مياه", nameEn: "Water Bottle", price: 150 },
    { slug: "juice", nameAr: "عصير طبيعي", nameEn: "Fresh Juice", price: 600 },
  ];
  for (const [i, d] of drinks.entries()) {
    await prisma.product.upsert({
      where: { slug: d.slug },
      update: {},
      create: {
        slug: d.slug,
        categoryId: drinksCategory.id,
        nameAr: d.nameAr,
        nameEn: d.nameEn,
        basePriceMinor: d.price,
        availability: "AVAILABLE",
        sortOrder: i,
        prepMinutes: 2,
      },
    });
  }

  const desserts = [
    { slug: "chocolate-lava-cake", nameAr: "كيك الشوكولاتة", nameEn: "Chocolate Lava Cake", price: 900 },
    { slug: "cheesecake", nameAr: "تشيز كيك", nameEn: "Cheesecake", price: 1000 },
  ];
  for (const [i, d] of desserts.entries()) {
    await prisma.product.upsert({
      where: { slug: d.slug },
      update: {},
      create: {
        slug: d.slug,
        categoryId: dessertsCategory.id,
        nameAr: d.nameAr,
        nameEn: d.nameEn,
        basePriceMinor: d.price,
        availability: "AVAILABLE",
        sortOrder: i,
        prepMinutes: 5,
      },
    });
  }

  const staffPassword = process.env.SEED_STAFF_PASSWORD ?? "ChangeMe123!";
  const passwordHash = await bcrypt.hash(staffPassword, 10);

  await prisma.user.upsert({
    where: { email: "owner@pizzahouse.local" },
    update: {},
    create: {
      name: "Restaurant Owner",
      email: "owner@pizzahouse.local",
      passwordHash,
      role: "OWNER",
    },
  });
  await prisma.user.upsert({
    where: { email: "kitchen@pizzahouse.local" },
    update: {},
    create: {
      name: "Kitchen Staff",
      email: "kitchen@pizzahouse.local",
      passwordHash,
      role: "KITCHEN",
    },
  });

  console.log("Seed complete.");
  console.log(`Demo staff login password: ${staffPassword} (change via SEED_STAFF_PASSWORD env var)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
