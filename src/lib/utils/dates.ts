import { TZDate } from "@date-fns/tz";
import { addDays, differenceInCalendarDays, startOfDay } from "date-fns";

/** True when `tz` is an IANA zone name the runtime understands. */
export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** UTC instant of local midnight (in `tz`) for the day containing `at`. */
export function startOfDayInTz(at: Date, tz: string): Date {
  return new Date(startOfDay(new TZDate(at.getTime(), tz)).getTime());
}

/** UTC instant of local midnight `days` days after the local day containing `at`. */
export function startOfDayPlus(at: Date, tz: string, days: number): Date {
  return new Date(addDays(startOfDay(new TZDate(at.getTime(), tz)), days).getTime());
}

/** Boundaries used by every "due" computation for a user. */
export function dayBoundaries(now: Date, tz: string) {
  return {
    startOfToday: startOfDayInTz(now, tz),
    startOfTomorrow: startOfDayPlus(now, tz, 1),
  };
}

/**
 * Parses a YYYY-MM-DD calendar date as local midnight in `tz`.
 * Returns null for malformed input.
 */
export function parseLocalDate(value: string, tz: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  const local = new TZDate(y, mo, d, 0, 0, 0, tz);
  if (local.getFullYear() !== y || local.getMonth() !== mo || local.getDate() !== d) return null;
  return new Date(local.getTime());
}

/** Whole calendar days from `now` until `target` in `tz` (negative = in the past). */
export function calendarDaysUntil(target: Date, now: Date, tz: string): number {
  return differenceInCalendarDays(new TZDate(target.getTime(), tz), new TZDate(now.getTime(), tz));
}

/** YYYY-MM-DD for `at` in `tz`. */
export function localDateKey(at: Date, tz: string): string {
  const d = new TZDate(at.getTime(), tz);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
