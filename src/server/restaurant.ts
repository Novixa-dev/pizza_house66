import "server-only";

import { prisma } from "@/lib/db";
import type { BusinessHourRule, SchedulingConfig, ScheduleOverrideRule } from "@/lib/scheduling";
import { isOpenNow, resolveOpenWindow } from "@/lib/scheduling";
import { addDays } from "@/lib/time";
import type { Prisma } from "@prisma/client";

// There is exactly one restaurant row in this MVP (docs/DECISIONS.md —
// "single restaurant first, multi-tenant later"). Every read goes through
// here so no other module ever hardcodes an id or a restaurant value; adding
// a tenant filter later is a change to this file, not to the whole app.

export type RestaurantWithConfig = Prisma.RestaurantGetPayload<{
  include: { businessHours: true; scheduleOverrides: true; paymentMethods: true };
}>;

export class RestaurantNotConfiguredError extends Error {
  constructor() {
    super("Restaurant is not configured. Run `npm run db:seed` first.");
    this.name = "RestaurantNotConfiguredError";
  }
}

export async function getRestaurant(): Promise<RestaurantWithConfig> {
  const restaurant = await prisma.restaurant.findFirst({
    include: {
      businessHours: { orderBy: { dayOfWeek: "asc" } },
      // Only overrides that can still affect a bookable date matter; older
      // ones would just grow the payload on every page render.
      scheduleOverrides: {
        where: { date: { gte: addDays(new Date(), -1) } },
        orderBy: { date: "asc" },
      },
      paymentMethods: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!restaurant) throw new RestaurantNotConfiguredError();
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

/** Bundles everything the pure scheduling functions need from the database. */
export function schedulingConfigFor(restaurant: RestaurantWithConfig): SchedulingConfig {
  return {
    timeZone: restaurant.timezone,
    hours: toBusinessHourRules(restaurant.businessHours),
    overrides: toScheduleOverrideRules(restaurant.scheduleOverrides),
    slotIntervalMinutes: restaurant.slotIntervalMinutes,
    maxScheduleDaysAhead: restaurant.maxScheduleDaysAhead,
  };
}

export interface RestaurantStatus {
  open: boolean;
  acceptingOrders: boolean;
  opensAt: Date | null;
  closesAt: Date | null;
}

/** Drives the "Open now" badge and the checkout gate in one place. */
export function restaurantStatus(
  restaurant: RestaurantWithConfig,
  now = new Date()
): RestaurantStatus {
  const config = schedulingConfigFor(restaurant);
  const open = isOpenNow(now, config.hours, config.overrides, config.timeZone);
  const window = resolveOpenWindow(now, config.hours, config.overrides, config.timeZone);
  return {
    open,
    acceptingOrders: !restaurant.onlineOrderingPaused,
    opensAt: window?.opensAt ?? null,
    closesAt: window?.closesAt ?? null,
  };
}

export function enabledPaymentMethods(restaurant: RestaurantWithConfig) {
  return restaurant.paymentMethods.filter((method) => method.enabled);
}
