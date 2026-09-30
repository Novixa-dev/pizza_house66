import { describe, expect, it } from "vitest";
import {
  formatOpeningHours,
  toSchemaOpeningHours,
  type BusinessHourLike,
} from "@/lib/hours-display";

const DAYS_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

function window(dayOfWeek: number, opensAt: string, closesAt: string): BusinessHourLike {
  return { dayOfWeek, opensAt, closesAt, closed: false };
}

/** The real Pizza House 66 week: two services, and no Friday morning. */
const REAL_WEEK: BusinessHourLike[] = Array.from({ length: 7 }, (_, day) =>
  day === 5
    ? [window(day, "16:00", "23:30")]
    : [window(day, "08:00", "12:00"), window(day, "16:00", "23:30")]
).flat();

describe("formatOpeningHours", () => {
  it("shows both of a day's services, not just one", () => {
    // The Map-keyed-on-day version kept the last row and silently dropped the
    // morning, so every page told customers the kitchen opened at 16:00.
    const rows = formatOpeningHours(REAL_WEEK, "en", DAYS_EN);
    expect(rows[0]!.value).toBe("08:00 – 12:00, 16:00 – 23:30");
  });

  it("separates the services with an Arabic comma in Arabic", () => {
    const rows = formatOpeningHours(REAL_WEEK, "ar", DAYS_AR);
    expect(rows[0]!.value).toBe("08:00 – 12:00، 16:00 – 23:30");
  });

  it("groups the identical days and breaks the run at Friday", () => {
    const rows = formatOpeningHours(REAL_WEEK, "en", DAYS_EN);
    expect(rows.map((row) => row.label)).toEqual([
      "Sunday – Thursday",
      "Friday",
      "Saturday",
    ]);
    expect(rows[1]!.value).toBe("16:00 – 23:30");
  });

  it("collapses a uniform week to one line", () => {
    const uniform = Array.from({ length: 7 }, (_, day) => window(day, "16:00", "23:30"));
    const rows = formatOpeningHours(uniform, "en", DAYS_EN);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ label: "Every day", value: "16:00 – 23:30", closed: false });
  });

  it("reports a day with no windows as closed", () => {
    const week = REAL_WEEK.filter((hour) => hour.dayOfWeek !== 1);
    const rows = formatOpeningHours(week, "en", DAYS_EN);
    const monday = rows.find((row) => row.label === "Monday");
    expect(monday).toEqual({ label: "Monday", value: "Closed", closed: true });
  });

  it("treats a row marked closed as no window at all", () => {
    const week = [...REAL_WEEK, { dayOfWeek: 1, opensAt: "03:00", closesAt: "04:00", closed: true }];
    const rows = formatOpeningHours(week, "en", DAYS_EN);
    expect(rows.find((row) => row.label === "Monday")).toBeUndefined();
    // Monday is still inside the Sunday–Thursday run, unchanged.
    expect(rows[0]!.label).toBe("Sunday – Thursday");
  });

  it("orders a day's services by opening time whatever order they arrive in", () => {
    const shuffled = [window(0, "16:00", "23:30"), window(0, "08:00", "12:00")];
    expect(formatOpeningHours(shuffled, "en", DAYS_EN)[0]!.value).toBe(
      "08:00 – 12:00, 16:00 – 23:30"
    );
  });

  it("returns nothing when there are no hours at all", () => {
    expect(formatOpeningHours([], "en", DAYS_EN)).toEqual([]);
  });
});

describe("toSchemaOpeningHours", () => {
  it("emits one entry per service, so search engines see both", () => {
    const schema = toSchemaOpeningHours(REAL_WEEK);
    expect(schema).toContain("Su 08:00-12:00");
    expect(schema).toContain("Su 16:00-23:30");
    expect(schema).toContain("Fr 16:00-23:30");
    expect(schema).not.toContain("Fr 08:00-12:00");
  });

  it("rewrites a midnight close as 23:59, which schema.org can express", () => {
    expect(toSchemaOpeningHours([window(0, "16:00", "00:00")])).toEqual(["Su 16:00-23:59"]);
  });
});
