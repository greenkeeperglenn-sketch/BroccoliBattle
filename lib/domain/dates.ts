/**
 * Date & week rules.
 *
 * All timestamps are stored in UTC. The household timezone (default
 * Europe/London) is authoritative for deriving the local day and the game
 * week: Monday 00:00:00 → Sunday 23:59:59.999 local time.
 *
 * Local dates are passed around as "YYYY-MM-DD" strings. Arithmetic on them
 * uses UTC-anchored Date objects, which is timezone-free and DST-safe.
 */

export type LocalDate = string; // "YYYY-MM-DD"

const localDateFormatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let f = localDateFormatters.get(timeZone);
  if (!f) {
    // en-CA formats as YYYY-MM-DD.
    f = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    localDateFormatters.set(timeZone, f);
  }
  return f;
}

/** The local calendar date of a UTC instant in the given timezone. */
export function localDateOf(instant: Date, timeZone: string): LocalDate {
  return formatterFor(timeZone).format(instant);
}

/** 0 = Monday … 6 = Sunday for a local date string. */
export function dayIndexOf(date: LocalDate): number {
  const utcDay = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return (utcDay + 6) % 7;
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Monday of the week containing the given local date. */
export function weekStartOf(date: LocalDate): LocalDate {
  return addDays(date, -dayIndexOf(date));
}

/** Sunday of the week starting at the given Monday. */
export function weekEndOf(weekStart: LocalDate): LocalDate {
  return addDays(weekStart, 6);
}

/** The seven local dates of a game week, Monday first. */
export function weekDates(weekStart: LocalDate): LocalDate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

/** First day of the month containing the given local date. */
export function monthStartOf(date: LocalDate): LocalDate {
  return `${date.slice(0, 7)}-01`;
}

export function isBefore(a: LocalDate, b: LocalDate): boolean {
  return a < b; // ISO strings compare lexicographically
}

/** Current week start for a household, from a UTC instant. */
export function currentWeekStart(now: Date, timeZone: string): LocalDate {
  return weekStartOf(localDateOf(now, timeZone));
}

// ─── Display helpers ────────────────────────────────────────────────────────

export function formatLocalDate(
  date: LocalDate,
  opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" },
): string {
  return new Intl.DateTimeFormat("en-GB", {
    ...opts,
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

export function formatWeekRange(weekStart: LocalDate): string {
  const start = formatLocalDate(weekStart, { day: "numeric", month: "short" });
  const end = formatLocalDate(weekEndOf(weekStart), {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${start} – ${end}`;
}

export function formatTime(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(instant);
}
