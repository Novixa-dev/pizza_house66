import { prisma } from "@/lib/db";
import type { BusinessHourRule, ScheduleOverrideRule } from "@/lib/scheduling";

// There is exactly one restaurant row for the MVP (see docs/DECISIONS.md —
// "single-restaurant first, multi-tenant later"). This helper centralizes
// that lookup so the rest of the app never hardcodes an id.
export async function getRestaurant() {
  const restaurant = await prisma.restaurant.findFirst({
    include: { businessHours: true, scheduleOverrides: true, paymentMethods: true },
  });
  if (!restaurant) {
    throw new Error("Restaurant is not configured. Run `npm run db:seed` first.");
  }
  return restaurant;
}

export function toBusinessHourRules(
  hours: { dayOfWeek: number; opensAt: string; closesAt: string; closed: boolean }[]
): BusinessHourRule[] {
  return hours.map((h) => ({
    dayOfWeek: h.dayOfWeek,
    opensAt: h.opensAt,
    closesAt: h.closesAt,
    closed: h.closed,
  }));
}

export function toScheduleOverrideRules(
  overrides: { date: Date; closed: boolean; opensAt: string | null; closesAt: string | null }[]
): ScheduleOverrideRule[] {
  return overrides.map((o) => ({
    date: o.date,
    closed: o.closed,
    opensAt: o.opensAt,
    closesAt: o.closesAt,
  }));
}
