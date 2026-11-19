export type SalesRange = '7d' | '30d' | '3m' | '6m';

export interface RawOrder {
  created_at: string;
  total_amount: number;
}

export interface SalesBar {
  label: string;
  total: number;
}

export const SALES_RANGES: { value: SalesRange; label: string; heading: string }[] = [
  { value: '7d', label: '7 days', heading: 'last 7 days' },
  { value: '30d', label: '30 days', heading: 'last 4 weeks' },
  { value: '3m', label: '3 months', heading: 'last 13 weeks' },
  { value: '6m', label: '6 months', heading: 'last 6 months' },
];

export function rangeHeading(range: SalesRange): string {
  return SALES_RANGES.find((r) => r.value === range)?.heading ?? 'last 7 days';
}

const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function startOfDay(d: Date) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

/** 7 days: one bar per day (unchanged from the original chart). */
export function bucketWeek(orders: RawOrder[], now: Date = new Date()): SalesBar[] {
  const today = startOfDay(now);
  const days: { key: string; label: string; total: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push({ key: d.toISOString().split('T')[0], label: DAY_ABBR[d.getDay()], total: 0 });
  }
  const byKey = new Map(days.map((d) => [d.key, d]));
  orders.forEach((o) => {
    const key = new Date(o.created_at).toISOString().split('T')[0];
    const bucket = byKey.get(key);
    if (bucket) bucket.total += o.total_amount;
  });
  return days.map((d) => ({ label: d.label, total: d.total }));
}

/** Weekly bars over the last `weeks` x 7 days, labelled "Wk 1".."Wk n" (oldest first). */
function bucketWeeks(orders: RawOrder[], weeks: number, now: Date): SalesBar[] {
  const today = startOfDay(now);
  const start = new Date(today);
  start.setDate(start.getDate() - (weeks * 7 - 1));

  const buckets = Array.from({ length: weeks }, (_, i) => ({ label: `Wk ${i + 1}`, total: 0 }));
  orders.forEach((o) => {
    const created = startOfDay(new Date(o.created_at));
    if (created < start || created > today) return;
    const dayIndex = Math.floor((created.getTime() - start.getTime()) / 86400000);
    const bucketIndex = Math.min(weeks - 1, Math.floor(dayIndex / 7));
    buckets[bucketIndex].total += o.total_amount;
  });
  return buckets;
}

/** 30 days: 28-day window, 4 buckets of 7 days (unchanged from the original chart). */
export function bucketMonth(orders: RawOrder[], now: Date = new Date()): SalesBar[] {
  return bucketWeeks(orders, 4, now);
}

/** 3 months: 91-day window, 13 weekly buckets (same weekly style as 30 days). */
export function bucketQuarter(orders: RawOrder[], now: Date = new Date()): SalesBar[] {
  return bucketWeeks(orders, 13, now);
}

/** 6 months: the current calendar month and the 5 before it, one bar per month. */
export function bucketHalfYear(orders: RawOrder[], now: Date = new Date()): SalesBar[] {
  const months: { year: number; month: number; label: string; total: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth(), label: MONTH_ABBR[d.getMonth()], total: 0 });
  }
  const today = startOfDay(now);
  orders.forEach((o) => {
    const created = new Date(o.created_at);
    if (startOfDay(created) > today) return;
    const bucket = months.find((m) => m.year === created.getFullYear() && m.month === created.getMonth());
    if (bucket) bucket.total += o.total_amount;
  });
  return months.map((m) => ({ label: m.label, total: m.total }));
}

export function bucketSales(orders: RawOrder[], range: SalesRange, now: Date = new Date()): SalesBar[] {
  switch (range) {
    case '3m':
      return bucketQuarter(orders, now);
    case '6m':
      return bucketHalfYear(orders, now);
    case '30d':
      return bucketMonth(orders, now);
    case '7d':
    default:
      return bucketWeek(orders, now);
  }
}
