import { describe, it, expect } from 'vitest';
import { mondayOf, weekdayIndexOf, recomputeWeekDays } from './stockService';

describe('stockService date helpers', () => {
  it('mondayOf returns the Monday of the week containing a date', () => {
    // Friday 2026-08-28 -> Monday 2026-08-24
    const friday = new Date(2026, 7, 28); // Aug 28 2026 is a Friday
    const monday = mondayOf(friday);
    expect(monday.getDay()).toBe(1);
    expect(monday.getFullYear()).toBe(2026);
    expect(monday.getMonth()).toBe(7);
    expect(monday.getDate()).toBe(24);
  });

  it('mondayOf handles a Monday itself (same day)', () => {
    const monday = new Date(2026, 7, 24);
    expect(mondayOf(monday).getDate()).toBe(24);
  });

  it('mondayOf maps Sunday to the previous Monday', () => {
    const sunday = new Date(2026, 7, 30); // Aug 30 2026 is a Sunday
    const monday = mondayOf(sunday);
    expect(monday.getDay()).toBe(1);
    expect(monday.getDate()).toBe(24);
  });

  it('weekdayIndexOf maps Mon=0 .. Sun=6', () => {
    expect(weekdayIndexOf(new Date(2026, 7, 24))).toBe(0); // Mon
    expect(weekdayIndexOf(new Date(2026, 7, 28))).toBe(4); // Fri
    expect(weekdayIndexOf(new Date(2026, 7, 30))).toBe(6); // Sun
  });
});

describe('recomputeWeekDays cascade', () => {
  it('computes jumla = in + prev baki and baki = jumla - uza across 7 days', () => {
    const days = [
      { in: 100, jumla: 0, uza: 10, baki: 0 },
      { in: 0, jumla: 0, uza: 20, baki: 0 },
      { in: 50, jumla: 0, uza: 5, baki: 0 },
      { in: 0, jumla: 0, uza: 0, baki: 0 },
      { in: 0, jumla: 0, uza: 0, baki: 0 },
      { in: 0, jumla: 0, uza: 0, baki: 0 },
      { in: 0, jumla: 0, uza: 0, baki: 0 },
    ];

    const result = recomputeWeekDays(days);

    // Day 0: jumla = 100, baki = 100 - 10 = 90
    expect(result[0].jumla).toBe(100);
    expect(result[0].baki).toBe(90);
    // Day 1: jumla = 0 + 90 = 90, baki = 90 - 20 = 70
    expect(result[1].jumla).toBe(90);
    expect(result[1].baki).toBe(70);
    // Day 2: jumla = 50 + 70 = 120, baki = 120 - 5 = 115
    expect(result[2].jumla).toBe(120);
    expect(result[2].baki).toBe(115);
    // Day 3: jumla = 0 + 115 = 115, baki = 115
    expect(result[3].jumla).toBe(115);
    expect(result[3].baki).toBe(115);
    // Final day carries on
    expect(result[6].baki).toBe(115);
  });

  it('never returns negative jumla or baki', () => {
    const days = [
      { in: 10, jumla: 0, uza: 100, baki: 0 },
      { in: 0, jumla: 0, uza: 0, baki: 0 },
      { in: 0, jumla: 0, uza: 0, baki: 0 },
      { in: 0, jumla: 0, uza: 0, baki: 0 },
      { in: 0, jumla: 0, uza: 0, baki: 0 },
      { in: 0, jumla: 0, uza: 0, baki: 0 },
      { in: 0, jumla: 0, uza: 0, baki: 0 },
    ];
    const result = recomputeWeekDays(days);
    for (const d of result) {
      expect(d.jumla).toBeGreaterThanOrEqual(0);
      expect(d.baki).toBeGreaterThanOrEqual(0);
    }
    expect(result[0].baki).toBe(0);
  });
});
