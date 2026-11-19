import { describe, it, expect } from 'vitest';
import {
  SALES_RANGES,
  bucketHalfYear,
  bucketMonth,
  bucketQuarter,
  bucketSales,
  bucketWeek,
  rangeHeading,
} from './salesBuckets';

// Midday local time avoids day-boundary edge cases in the fixtures.
const NOW = new Date(2026, 10, 19, 12, 0, 0); // 19 Nov 2026
function daysAgo(n: number, amount: number) {
  const d = new Date(NOW);
  d.setDate(d.getDate() - n);
  return { created_at: d.toISOString(), total_amount: amount };
}

describe('sales ranges', () => {
  it('keeps 7 days and 30 days first, with 7 days as the first option', () => {
    expect(SALES_RANGES.map((r) => r.value)).toEqual(['7d', '30d', '3m', '6m']);
    expect(SALES_RANGES.map((r) => r.label)).toEqual(['7 days', '30 days', '3 months', '6 months']);
    expect(rangeHeading('7d')).toBe('last 7 days');
    expect(rangeHeading('30d')).toBe('last 4 weeks');
    expect(rangeHeading('3m')).toBe('last 13 weeks');
    expect(rangeHeading('6m')).toBe('last 6 months');
  });

  it('7 days: seven daily bars ending today', () => {
    const bars = bucketWeek([daysAgo(0, 100), daysAgo(6, 50), daysAgo(7, 999)], NOW);
    expect(bars).toHaveLength(7);
    expect(bars[6]).toEqual({ label: 'Thu', total: 100 });
    expect(bars[0].total).toBe(50);
    expect(bars.reduce((s, b) => s + b.total, 0)).toBe(150);
  });

  it('30 days: four weekly bars over 28 days (unchanged)', () => {
    const bars = bucketMonth([daysAgo(0, 10), daysAgo(27, 20), daysAgo(28, 999)], NOW);
    expect(bars.map((b) => b.label)).toEqual(['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4']);
    expect(bars[0].total).toBe(20);
    expect(bars[3].total).toBe(10);
  });

  it('3 months: thirteen weekly bars over 91 days', () => {
    const bars = bucketQuarter([daysAgo(0, 10), daysAgo(90, 20), daysAgo(91, 999), daysAgo(45, 5)], NOW);
    expect(bars).toHaveLength(13);
    expect(bars[0]).toEqual({ label: 'Wk 1', total: 20 });
    expect(bars[12]).toEqual({ label: 'Wk 13', total: 10 });
    expect(bars.reduce((s, b) => s + b.total, 0)).toBe(35);
  });

  it('6 months: six calendar-month bars ending with the current month', () => {
    const orders = [
      { created_at: new Date(2026, 10, 2, 12).toISOString(), total_amount: 10 },
      { created_at: new Date(2026, 5, 1, 12).toISOString(), total_amount: 20 },
      { created_at: new Date(2026, 4, 31, 12).toISOString(), total_amount: 999 },
      { created_at: new Date(2026, 7, 15, 12).toISOString(), total_amount: 5 },
    ];
    const bars = bucketHalfYear(orders, NOW);
    expect(bars.map((b) => b.label)).toEqual(['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov']);
    expect(bars.map((b) => b.total)).toEqual([20, 0, 5, 0, 0, 10]);
  });

  it('6 months crosses a year boundary', () => {
    const bars = bucketHalfYear([], new Date(2027, 1, 10, 12));
    expect(bars.map((b) => b.label)).toEqual(['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb']);
  });

  it('bucketSales routes each range', () => {
    expect(bucketSales([], '7d', NOW)).toHaveLength(7);
    expect(bucketSales([], '30d', NOW)).toHaveLength(4);
    expect(bucketSales([], '3m', NOW)).toHaveLength(13);
    expect(bucketSales([], '6m', NOW)).toHaveLength(6);
  });
});
