import { describe, it, expect } from 'vitest';
import { dateKey } from './tracker.js';
import {
  weekDatesContaining,
  weekDates,
  monthInfo,
  weekLabel,
  rangeStats,
  weeksOverlappingMonth,
} from './progressStats.js';

// A fixed "now" so every relative-offset calculation is deterministic.
// 2026-06-24 is a Wednesday, inside the Jun 22–28 (Mon–Sun) week.
const NOW = new Date('2026-06-24T15:00:00');

describe('weekDatesContaining', () => {
  it('returns the Monday-start week around a date', () => {
    const days = weekDatesContaining(NOW);
    expect(days).toHaveLength(7);
    expect(days.map((d) => d.getDate())).toEqual([22, 23, 24, 25, 26, 27, 28]);
    expect(days[0].getDay()).toBe(1); // Monday
    expect(days[6].getDay()).toBe(0); // Sunday
  });
});

describe('weekDates (relative offset)', () => {
  it('0 = current week, -1 = previous week', () => {
    expect(weekDates(0, NOW).map((d) => d.getDate())).toEqual([22, 23, 24, 25, 26, 27, 28]);
    expect(weekDates(-1, NOW).map((d) => d.getDate())).toEqual([15, 16, 17, 18, 19, 20, 21]);
  });
});

describe('weekLabel', () => {
  it('formats a within-month week', () => {
    expect(weekLabel(weekDatesContaining(NOW))).toBe('Jun 22 – 28');
  });
  it('formats a cross-month week', () => {
    // The week containing Jun 30 runs Mon Jun 29 – Sun Jul 5.
    expect(weekLabel(weekDatesContaining(new Date('2026-06-30T12:00:00')))).toBe('Jun 29 – Jul 5');
  });
});

describe('monthInfo', () => {
  it('describes the current month', () => {
    const m = monthInfo(0, NOW);
    expect(m.label).toBe('June 2026');
    expect(m.daysInMonth).toBe(30);
    expect(m.days).toHaveLength(30);
  });
  it('handles a relative offset into a 31-day month', () => {
    const m = monthInfo(-1, NOW);
    expect(m.label).toBe('May 2026');
    expect(m.daysInMonth).toBe(31);
  });
});

describe('rangeStats', () => {
  // Sessions: Jun 22 (2 exercises), Jun 24 (1), and a future day Jun 27.
  const dateMap = new Map([
    ['2026-06-22', [{ id: 1 }, { id: 2 }]],
    ['2026-06-24', [{ id: 1 }]],
    ['2026-06-27', [{ id: 3 }]], // after NOW — must be ignored
  ]);

  it('counts exercise days, sessions, and distinct types up to today', () => {
    const stats = rangeStats(dateMap, weekDatesContaining(NOW), NOW);
    expect(stats.exerciseDays).toBe(2); // Jun 22 + Jun 24 (Jun 27 is future)
    expect(stats.totalSessions).toBe(3); // 2 + 1
    expect(stats.exerciseTypes).toBe(2); // ids 1 and 2
  });

  it('ignores days with no logged sessions', () => {
    const stats = rangeStats(new Map(), weekDatesContaining(NOW), NOW);
    expect(stats).toEqual({ exerciseDays: 0, totalSessions: 0, exerciseTypes: 0 });
  });
});

describe('weeksOverlappingMonth', () => {
  it('lists the Monday-start weeks touching the month, newest first', () => {
    const { year, month } = monthInfo(0, NOW); // June 2026
    const weeks = weeksOverlappingMonth(year, month, NOW);
    // June 2026: Mon Jun 1 starts week one; the last week is Mon Jun 29 – Jul 5.
    expect(weeks[0].days[0].getDate()).toBe(29); // newest week first
    expect(weeks.at(-1).days[0].getDate()).toBe(1); // oldest week last

    const current = weeks.find((w) => w.isCurrent);
    expect(current.weekOffset).toBe(0);
    expect(current.days.map((d) => d.getDate())).toEqual([22, 23, 24, 25, 26, 27, 28]);

    // The Jun 29 week lies past the current week → flagged future.
    expect(weeks[0].isFuture).toBe(true);
    expect(weeks[0].weekOffset).toBe(1);
  });

  it('assigns negative offsets to earlier weeks', () => {
    const { year, month } = monthInfo(0, NOW);
    const weeks = weeksOverlappingMonth(year, month, NOW);
    const firstWeek = weeks.at(-1); // Jun 1–7
    expect(firstWeek.weekOffset).toBe(-3);
    expect(firstWeek.isFuture).toBe(false);
    expect(dateKey(firstWeek.days[0])).toBe('2026-06-01');
  });
});
