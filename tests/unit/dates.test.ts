import { describe, expect, it } from "vitest";
import {
  addDays,
  currentWeekStart,
  dayIndexOf,
  localDateOf,
  monthStartOf,
  weekDates,
  weekEndOf,
  weekStartOf,
} from "@/lib/domain/dates";

const TZ = "Europe/London";

describe("localDateOf", () => {
  it("maps a UTC instant to the London calendar day", () => {
    expect(localDateOf(new Date("2026-08-19T12:00:00Z"), TZ)).toBe("2026-08-19");
  });

  it("handles late-night BST entries (23:30 local is next day in UTC)", () => {
    // 23:30 London on 19 Aug 2026 BST = 22:30 UTC same day.
    expect(localDateOf(new Date("2026-08-19T22:30:00Z"), TZ)).toBe("2026-08-19");
    // 23:30 UTC = 00:30 London on the 20th.
    expect(localDateOf(new Date("2026-08-19T23:30:00Z"), TZ)).toBe("2026-08-20");
  });

  it("handles GMT winter time without offset", () => {
    expect(localDateOf(new Date("2026-01-10T23:30:00Z"), TZ)).toBe("2026-01-10");
  });

  it("year boundary: NYE 23:30 UTC in winter is still 31 Dec in London", () => {
    expect(localDateOf(new Date("2026-12-31T23:30:00Z"), TZ)).toBe("2026-12-31");
    expect(localDateOf(new Date("2027-01-01T00:30:00Z"), TZ)).toBe("2027-01-01");
  });
});

describe("week boundaries", () => {
  it("computes Monday as week start", () => {
    expect(weekStartOf("2026-08-19")).toBe("2026-08-17"); // Wednesday → Monday
    expect(weekStartOf("2026-08-17")).toBe("2026-08-17"); // Monday is itself
    expect(weekStartOf("2026-08-23")).toBe("2026-08-17"); // Sunday stays in week
  });

  it("Sunday 23:59 local is still the old week; Monday 00:00 is the new one", () => {
    // Sunday 23 Aug 2026 23:59 London (BST) = 22:59 UTC.
    const sundayNight = new Date("2026-08-23T22:59:00Z");
    expect(currentWeekStart(sundayNight, TZ)).toBe("2026-08-17");
    // Monday 00:00 London = Sunday 23:00 UTC.
    const mondayMorning = new Date("2026-08-23T23:00:00Z");
    expect(currentWeekStart(mondayMorning, TZ)).toBe("2026-08-24");
  });

  it("BST → GMT transition week (clocks back 25 Oct 2026) has stable bounds", () => {
    // The transition Sunday still belongs to the week starting Mon 19 Oct.
    const duringTransition = new Date("2026-10-25T01:30:00Z");
    expect(currentWeekStart(duringTransition, TZ)).toBe("2026-10-19");
    // After the clocks go back, Monday 00:00 London = 00:00 UTC.
    const nextMonday = new Date("2026-10-26T00:00:00Z");
    expect(currentWeekStart(nextMonday, TZ)).toBe("2026-10-26");
    // 23:30 UTC Sunday is Monday only after GMT begins — it is 23:30 London.
    expect(currentWeekStart(new Date("2026-10-25T23:30:00Z"), TZ)).toBe(
      "2026-10-19",
    );
  });

  it("GMT → BST transition (clocks forward 29 Mar 2026)", () => {
    // Sunday 29 Mar 2026 00:30 UTC = 00:30 London (GMT still).
    expect(currentWeekStart(new Date("2026-03-29T00:30:00Z"), TZ)).toBe(
      "2026-03-23",
    );
    // Monday 30 Mar 00:00 London (BST) = Sunday 23:00 UTC.
    expect(currentWeekStart(new Date("2026-03-29T23:00:00Z"), TZ)).toBe(
      "2026-03-30",
    );
  });

  it("year-boundary week spans both years", () => {
    expect(weekStartOf("2027-01-01")).toBe("2026-12-28");
    expect(weekEndOf("2026-12-28")).toBe("2027-01-03");
  });

  it("weekDates returns seven consecutive days", () => {
    const days = weekDates("2026-08-17");
    expect(days).toHaveLength(7);
    expect(days[0]).toBe("2026-08-17");
    expect(days[6]).toBe("2026-08-23");
  });
});

describe("date arithmetic", () => {
  it("addDays crosses months and years", () => {
    expect(addDays("2026-08-31", 1)).toBe("2026-09-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("dayIndexOf treats Monday as 0", () => {
    expect(dayIndexOf("2026-08-17")).toBe(0);
    expect(dayIndexOf("2026-08-23")).toBe(6);
  });

  it("monthStartOf", () => {
    expect(monthStartOf("2026-08-19")).toBe("2026-08-01");
  });
});
