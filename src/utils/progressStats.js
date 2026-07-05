import { dateKey, mondayIndex } from './tracker.js';

// The Progress tab summarizes activity over a chosen period — either a
// calendar month or a Monday-start week. Everything here is derived from the
// same `dateMap` (dateKey -> [{ id, name, time }, …]) the calendar already
// builds (getCompletionDateMap), so the summary can never disagree with the
// dots on the grid.

// The seven Date objects (local midnight) of the Monday-start week that
// contains `date`.
export function weekDatesContaining(date) {
  const monday = new Date(date);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - mondayIndex(monday));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

// weekOffset is relative to the current week: 0 = this week, -1 = last week.
export function weekDates(weekOffset, now = new Date()) {
  const base = new Date(now);
  base.setDate(base.getDate() + weekOffset * 7);
  return weekDatesContaining(base);
}

// The weekOffset (0 = current week, -1 = last) of the week containing `date` —
// used to jump from a tapped calendar day or week card into Week mode.
export function weekOffsetOf(date, now = new Date()) {
  const monday = weekDatesContaining(date)[0];
  const currentMonday = weekDatesContaining(now)[0];
  return Math.round((monday - currentMonday) / (7 * 24 * 60 * 60 * 1000));
}

// monthOffset is relative to the current month: 0 = this month, -1 = last.
export function monthInfo(monthOffset, now = new Date()) {
  const base = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const year = base.getFullYear();
  const month = base.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1));
  return {
    year,
    month,
    daysInMonth,
    days,
    label: base.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
  };
}

// "Jun 22 – 28" within a month, "Jun 29 – Jul 5" across one.
export function weekLabel(days) {
  const start = days[0];
  const end = days[6];
  const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
  const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
  return startMonth === endMonth
    ? `${startMonth} ${start.getDate()} – ${end.getDate()}`
    : `${startMonth} ${start.getDate()} – ${endMonth} ${end.getDate()}`;
}

// Activity totals for a set of days: how many of them had at least one logged
// session (exercise days), the total number of sessions across them, and how
// many distinct exercises appeared. Days after `today` are ignored so an
// in-progress period doesn't count sessions that haven't happened.
export function rangeStats(dateMap, days, today = new Date()) {
  const todayKey = dateKey(today);
  let exerciseDays = 0;
  let totalSessions = 0;
  const typeIds = new Set();
  for (const d of days) {
    const key = dateKey(d);
    if (key > todayKey) continue;
    const entries = dateMap.get(key);
    if (entries && entries.length > 0) {
      exerciseDays += 1;
      totalSessions += entries.length;
      for (const e of entries) typeIds.add(e.id);
    }
  }
  return { exerciseDays, totalSessions, exerciseTypes: typeIds.size };
}

// The Monday-start weeks that overlap a given month, most-recent-first (the
// order the "Total per week" list shows them). Each carries its own days, a
// weekOffset for navigating to it in Week mode, whether it's the current week,
// and whether it lies entirely in the future (which the caller hides).
export function weeksOverlappingMonth(year, month, now = new Date()) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const currentMonday = weekDatesContaining(now)[0];

  const weeks = [];
  const cursor = weekDatesContaining(first)[0];
  while (cursor <= last) {
    const days = weekDatesContaining(cursor);
    const monday = days[0];
    const weekOffset = Math.round((monday - currentMonday) / (7 * 24 * 60 * 60 * 1000));
    weeks.push({
      days,
      weekOffset,
      isCurrent: weekOffset === 0,
      isFuture: monday > currentMonday,
    });
    cursor.setDate(cursor.getDate() + 7);
  }
  return weeks.reverse();
}
