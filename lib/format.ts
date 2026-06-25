export function fmtMoney(n: number, currency = "EGP"): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(n || 0);
  } catch {
    return (n || 0).toFixed(2);
  }
}

export function fmtNum(n: number): string {
  return new Intl.NumberFormat().format(n || 0);
}

/** Format a 0..1 fraction as a percentage, e.g. 0.625 -> "62.50%". */
export function fmtPct(fraction: number, digits = 2): string {
  return `${((fraction || 0) * 100).toFixed(digits)}%`;
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Current month as "YYYY-MM". */
export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** First and last day (ISO) of a "YYYY-MM" month. */
export function monthBounds(month: string): { start: string; end: string } {
  const [y, m] = month.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0); // day 0 of next month = last day of this month
  return { start: toISODate(start), end: toISODate(end) };
}

export type RangePreset =
  | "today"
  | "yesterday"
  | "last7"
  | "last30"
  | "this_month"
  | "last_month"
  | "this_year";

export const PRESET_LABELS: Record<RangePreset, string> = {
  today: "Today",
  yesterday: "Yesterday",
  last7: "Last 7 days",
  last30: "Last 30 days",
  this_month: "This month",
  last_month: "Last month",
  this_year: "This year",
};

/** Resolve a preset key to an ISO {start,end} range. */
export function rangeForPreset(key: RangePreset): { start: string; end: string } {
  const now = new Date();
  const d = (date: Date) => toISODate(date);
  switch (key) {
    case "today":
      return { start: d(now), end: d(now) };
    case "yesterday": {
      const y = new Date(now);
      y.setDate(now.getDate() - 1);
      return { start: d(y), end: d(y) };
    }
    case "last7": {
      const s = new Date(now);
      s.setDate(now.getDate() - 6);
      return { start: d(s), end: d(now) };
    }
    case "last30": {
      const s = new Date(now);
      s.setDate(now.getDate() - 29);
      return { start: d(s), end: d(now) };
    }
    case "last_month": {
      const m = `${now.getFullYear()}-${String(now.getMonth()).padStart(2, "0")}`;
      // handle January (month 0) → previous year December
      if (now.getMonth() === 0) return monthBounds(`${now.getFullYear() - 1}-12`);
      return monthBounds(m);
    }
    case "this_year":
      return { start: `${now.getFullYear()}-01-01`, end: d(now) };
    case "this_month":
    default:
      return monthBounds(currentMonth());
  }
}

/** True if the range is exactly one full calendar month. */
export function isFullMonth(start: string, end: string): boolean {
  const month = start.slice(0, 7);
  const b = monthBounds(month);
  return start === b.start && end === b.end;
}
