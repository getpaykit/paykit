import * as z from "zod";

export const planIntervalValues = ["day", "week", "month", "quarterly", "biyear", "year"] as const;
export const meteredResetIntervalValues = [
  "day",
  "week",
  "biweek",
  "month",
  "quarterly",
  "biyear",
  "year",
] as const;

export const planIntervalSchema = z.enum(planIntervalValues);
export const meteredResetIntervalSchema = z.union([
  z.enum(meteredResetIntervalValues),
  z.coerce.number().int().positive("Reset interval seconds must be a positive integer"),
]);

export type PlanInterval = z.infer<typeof planIntervalSchema>;
export type MeteredResetInterval = z.infer<typeof meteredResetIntervalSchema>;

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  const day = next.getUTCDate();
  next.setUTCMonth(next.getUTCMonth() + months);
  if (next.getUTCDate() !== day) next.setUTCDate(0);
  return next;
}

function addYears(date: Date, years: number): Date {
  const next = new Date(date);
  const day = next.getUTCDate();
  next.setUTCFullYear(next.getUTCFullYear() + years);
  if (next.getUTCDate() !== day) next.setUTCDate(0);
  return next;
}

export function getSecondInterval(interval: string | number): number | null {
  if (typeof interval === "number") {
    if (!Number.isSafeInteger(interval) || interval <= 0) {
      throw new Error(`Invalid interval seconds: "${String(interval)}"`);
    }

    return interval;
  }

  if (!/^\d+$/u.test(interval)) {
    return null;
  }

  const seconds = Number(interval);
  if (!Number.isSafeInteger(seconds) || seconds <= 0) {
    throw new Error(`Invalid interval seconds: "${interval}"`);
  }

  return seconds;
}

export function addInterval(date: Date, interval: string | number): Date {
  const secondInterval = getSecondInterval(interval);
  if (secondInterval !== null) {
    return new Date(date.getTime() + secondInterval * 1000);
  }

  if (interval === "day") {
    const next = new Date(date);
    next.setUTCDate(next.getUTCDate() + 1);
    return next;
  }

  if (interval === "week") {
    const next = new Date(date);
    next.setUTCDate(next.getUTCDate() + 7);
    return next;
  }

  if (interval === "biweek") {
    const next = new Date(date);
    next.setUTCDate(next.getUTCDate() + 14);
    return next;
  }

  if (interval === "month") {
    return addMonths(date, 1);
  }

  if (interval === "quarterly") {
    return addMonths(date, 3);
  }

  if (interval === "biyear") {
    return addMonths(date, 6);
  }

  if (interval === "year") {
    return addYears(date, 1);
  }

  throw new Error(`Unsupported interval: "${interval}"`);
}

export function serializeMeteredResetInterval(interval: MeteredResetInterval): string {
  return typeof interval === "number" ? String(interval) : interval;
}

export function getStripeRecurringInterval(interval: PlanInterval): {
  count?: number;
  interval: "day" | "week" | "month" | "year";
} {
  if (interval === "quarterly") {
    return { count: 3, interval: "month" };
  }

  if (interval === "biyear") {
    return { count: 6, interval: "month" };
  }

  return { interval };
}
