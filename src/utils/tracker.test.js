import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FREQ } from '../data/exercises.js';
import {
  removeSessionOn,
  markDoneOn,
  isDueToday,
  isOptionalToday,
  isScheduledOn,
  isScheduledToday,
  getNextDueEstimate,
  getPlanProgressOn,
  getDaysOverdue,
  getStreak,
  getCompletionDateMap,
} from './tracker.js';

// Thursday, fixed so every "today"/"days ago" calculation below is
// deterministic regardless of when the suite actually runs.
const NOW = new Date('2026-07-02T15:00:00');

function daysAgoISO(n, hour = 12) {
  const d = new Date(NOW);
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function minutesAgoISO(n) {
  return new Date(NOW.getTime() - n * 60000).toISOString();
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

const dailyEx = { id: 1, freqType: FREQ.DAILY };
const dailyOrEodEx = { id: 2, freqType: FREQ.DAILY_OR_EOD };
const everyOtherDayEx = { id: 3, freqType: FREQ.EVERY_OTHER_DAY, freqDays: 2 };
const every3DaysEx = { id: 4, freqType: FREQ.EVERY_3_DAYS, freqDays: 3 };
const twiceWeeklyEx = { id: 5, freqType: FREQ.TWICE_WEEKLY, freqDays: 4 };
const multipleDailyEx = { id: 6, freqType: FREQ.MULTIPLE_DAILY, maxPerDay: 3 };
const hourlyEx = { id: 7, freqType: FREQ.HOURLY, freqMinutes: 90, dailyTarget: 8 };
const asNeededEx = { id: 8, freqType: FREQ.AS_NEEDED };

// Regression tests for issue #43: the exercise-detail undo action must only
// ever remove a session logged *today* — never reach back and silently
// delete a session from a prior day. `removeSessionOn` is the day-scoped
// helper `handleUndo` now uses instead of the old global `undoLast`.
describe('removeSessionOn (undo semantics)', () => {
  const tuesday = new Date('2026-06-30T12:00:00');
  const today = new Date('2026-07-02T12:00:00');

  it('removes only the target day\'s session, leaving other days untouched', () => {
    const completions = {
      '10': [tuesday.toISOString(), today.toISOString()],
    };
    const next = removeSessionOn(completions, 10, today);
    expect(next['10']).toEqual([tuesday.toISOString()]);
  });

  it('is a no-op when there is no session on the target day', () => {
    const completions = { '10': [tuesday.toISOString()] };
    const next = removeSessionOn(completions, 10, today);
    expect(next).toBe(completions);
    expect(next['10']).toEqual([tuesday.toISOString()]);
  });

  it('removes only the most recent session when the target day has several', () => {
    const first = new Date('2026-07-02T08:00:00').toISOString();
    const second = new Date('2026-07-02T14:00:00').toISOString();
    const completions = { '18': [tuesday.toISOString(), first, second] };
    const next = removeSessionOn(completions, 18, today);
    expect(next['18']).toEqual([tuesday.toISOString(), first]);
  });
});

describe('markDoneOn (chronological insert)', () => {
  it('keeps history sorted after inserting a back-dated session', () => {
    const completions = { '1': [daysAgoISO(10), daysAgoISO(1)] };
    const next = markDoneOn(completions, 1, new Date(NOW.getTime() - 5 * 86400000));
    const history = next['1'];
    expect(history).toHaveLength(3);
    expect(history).toEqual([...history].sort());
    // "last done" (history's last element) must still be the most recent
    // session chronologically, not just the most recently inserted one.
    expect(history[history.length - 1]).toBe(daysAgoISO(1));
  });
});

describe('isDueToday', () => {
  it('daily: due when not yet done today, not due once logged today', () => {
    expect(isDueToday(dailyEx, {})).toBe(true);
    expect(isDueToday(dailyEx, { '1': [daysAgoISO(0)] })).toBe(false);
  });

  it('daily-or-eod: due when not yet done today regardless of yesterday', () => {
    expect(isDueToday(dailyOrEodEx, {})).toBe(true);
    expect(isDueToday(dailyOrEodEx, { '2': [daysAgoISO(1)] })).toBe(true);
    expect(isDueToday(dailyOrEodEx, { '2': [daysAgoISO(0)] })).toBe(false);
  });

  it('every-other-day: due once the cadence gap has elapsed', () => {
    expect(isDueToday(everyOtherDayEx, {})).toBe(true);
    expect(isDueToday(everyOtherDayEx, { '3': [daysAgoISO(1)] })).toBe(false);
    expect(isDueToday(everyOtherDayEx, { '3': [daysAgoISO(2)] })).toBe(true);
  });

  it('every-3-days: due once the 3-day gap has elapsed', () => {
    expect(isDueToday(every3DaysEx, { '4': [daysAgoISO(2)] })).toBe(false);
    expect(isDueToday(every3DaysEx, { '4': [daysAgoISO(3)] })).toBe(true);
  });

  it('twice-weekly: due once the 4-day gap has elapsed', () => {
    expect(isDueToday(twiceWeeklyEx, { '5': [daysAgoISO(3)] })).toBe(false);
    expect(isDueToday(twiceWeeklyEx, { '5': [daysAgoISO(4)] })).toBe(true);
  });

  it('multiple-daily: due until the daily max is reached', () => {
    const two = { '6': [daysAgoISO(0), daysAgoISO(0)] };
    expect(isDueToday(multipleDailyEx, two)).toBe(true);
    const three = { '6': [daysAgoISO(0), daysAgoISO(0), daysAgoISO(0)] };
    expect(isDueToday(multipleDailyEx, three)).toBe(false);
  });

  it('hourly: due once the minutes gap has elapsed, capped by daily target', () => {
    expect(isDueToday(hourlyEx, {})).toBe(true);
    expect(isDueToday(hourlyEx, { '7': [minutesAgoISO(30)] })).toBe(false);
    expect(isDueToday(hourlyEx, { '7': [minutesAgoISO(90)] })).toBe(true);
    const atDailyTarget = { '7': Array.from({ length: 8 }, () => minutesAgoISO(200)) };
    expect(isDueToday(hourlyEx, atDailyTarget)).toBe(false);
  });

  it('as-needed: always due', () => {
    expect(isDueToday(asNeededEx, { '8': [daysAgoISO(0)] })).toBe(true);
  });
});

describe('isOptionalToday', () => {
  it('is true only for daily-or-eod done exactly yesterday and not yet today', () => {
    expect(isOptionalToday(dailyOrEodEx, { '2': [daysAgoISO(1)] })).toBe(true);
  });

  it('is false with no history, done today, or done 2+ days ago', () => {
    expect(isOptionalToday(dailyOrEodEx, {})).toBe(false);
    expect(isOptionalToday(dailyOrEodEx, { '2': [daysAgoISO(0)] })).toBe(false);
    expect(isOptionalToday(dailyOrEodEx, { '2': [daysAgoISO(2)] })).toBe(false);
  });

  it('is always false for other frequency types', () => {
    expect(isOptionalToday(everyOtherDayEx, { '3': [daysAgoISO(1)] })).toBe(false);
  });
});

describe('getNextDueEstimate', () => {
  it('is null for non-hourly exercises', () => {
    expect(getNextDueEstimate(dailyEx, { '1': [daysAgoISO(0)] })).toBeNull();
  });

  it('is null with no history or once the daily target is met', () => {
    expect(getNextDueEstimate(hourlyEx, {})).toBeNull();
    const atDailyTarget = { '7': Array.from({ length: 8 }, () => minutesAgoISO(10)) };
    expect(getNextDueEstimate(hourlyEx, atDailyTarget)).toBeNull();
  });

  it('estimates last-session-time plus the frequency gap when still in the future', () => {
    const completions = { '7': [minutesAgoISO(30)] };
    const next = getNextDueEstimate(hourlyEx, completions);
    expect(next).toEqual(new Date(NOW.getTime() + 60 * 60000));
  });

  it('is null once the estimate is already in the past', () => {
    const completions = { '7': [minutesAgoISO(200)] };
    expect(getNextDueEstimate(hourlyEx, completions)).toBeNull();
  });
});

describe('isScheduledOn / isScheduledToday', () => {
  it('daily, multiple-daily, and hourly are always scheduled', () => {
    expect(isScheduledOn(dailyEx, {}, NOW)).toBe(true);
    expect(isScheduledOn(multipleDailyEx, {}, NOW)).toBe(true);
    expect(isScheduledOn(hourlyEx, {}, NOW)).toBe(true);
  });

  it('as-needed is never scheduled (any session is bonus)', () => {
    expect(isScheduledOn(asNeededEx, {}, NOW)).toBe(false);
  });

  it('daily-or-eod is unscheduled only the day after it was done', () => {
    expect(isScheduledToday(dailyOrEodEx, { '2': [daysAgoISO(1)] })).toBe(false);
    expect(isScheduledToday(dailyOrEodEx, { '2': [daysAgoISO(2)] })).toBe(true);
    expect(isScheduledToday(dailyOrEodEx, {})).toBe(true);
  });

  it('interval exercises are scheduled once the cadence gap has elapsed since the prior session', () => {
    expect(isScheduledToday(everyOtherDayEx, { '3': [daysAgoISO(1)] })).toBe(false);
    expect(isScheduledToday(everyOtherDayEx, { '3': [daysAgoISO(2)] })).toBe(true);
    expect(isScheduledToday(everyOtherDayEx, {})).toBe(true);
  });
});

describe('getPlanProgressOn', () => {
  it('splits done work into plan-done and bonus-done, and counts only scheduled exercises toward the plan', () => {
    const exercises = [dailyEx, everyOtherDayEx, asNeededEx];
    const completions = {
      // daily: scheduled today, done today -> plan-done
      '1': [daysAgoISO(0)],
      // every-other-day: not due today (done yesterday) -> not on the plan;
      // doing it anyway today counts as bonus
      '3': [daysAgoISO(1), daysAgoISO(0)],
      // as-needed: never on the plan; done today -> bonus
      '8': [daysAgoISO(0)],
    };
    const { planTotal, planDone, bonusDone } = getPlanProgressOn(exercises, completions, NOW);
    // plan = { daily } = 1: every-other-day was already satisfied yesterday
    // so it's not scheduled today (as-needed is never scheduled either).
    expect(planTotal).toBe(1);
    // the daily one was both scheduled and done today
    expect(planDone).toBe(1);
    // every-other-day's extra session today + as-needed's session = 2 bonus
    expect(bonusDone).toBe(2);
  });

  it('is a 0/0 rest day when nothing is scheduled', () => {
    const exercises = [asNeededEx];
    const { planTotal, planDone, bonusDone } = getPlanProgressOn(exercises, {}, NOW);
    expect({ planTotal, planDone, bonusDone }).toEqual({ planTotal: 0, planDone: 0, bonusDone: 0 });
  });
});

describe('getDaysOverdue', () => {
  it('is 0 for multiple-daily, hourly, and as-needed', () => {
    expect(getDaysOverdue(multipleDailyEx, {})).toBe(0);
    expect(getDaysOverdue(hourlyEx, {})).toBe(0);
    expect(getDaysOverdue(asNeededEx, {})).toBe(0);
  });

  it('is 0 when there is no session before today to measure overdue-ness from', () => {
    expect(getDaysOverdue(dailyEx, {})).toBe(0);
    expect(getDaysOverdue(dailyEx, { '1': [daysAgoISO(0)] })).toBe(0);
  });

  it('counts consecutive scheduled-but-not-done days back from yesterday for a daily exercise', () => {
    // Last done 3 days ago: yesterday and the day before are both scheduled
    // (daily) and not done, so overdue = 2; the count stops at the day it
    // was actually done.
    const completions = { '1': [daysAgoISO(3)] };
    expect(getDaysOverdue(dailyEx, completions)).toBe(2);
  });

  it('does not count days an interval exercise was not actually scheduled', () => {
    // Every-other-day, last done 5 days ago: only days where isScheduledOn
    // is true AND not done count, so this should not run all the way to 4.
    const completions = { '3': [daysAgoISO(5)] };
    const overdue = getDaysOverdue(everyOtherDayEx, completions);
    expect(overdue).toBeGreaterThan(0);
    expect(overdue).toBeLessThan(5);
  });
});

describe('getStreak', () => {
  it('is 0 with no completions', () => {
    expect(getStreak({})).toBe(0);
  });

  it('counts consecutive days ending today', () => {
    const completions = { '1': [daysAgoISO(0), daysAgoISO(1), daysAgoISO(2)] };
    expect(getStreak(completions)).toBe(3);
  });

  it('still counts a streak ending yesterday if nothing is logged yet today', () => {
    const completions = { '1': [daysAgoISO(1), daysAgoISO(2)] };
    expect(getStreak(completions)).toBe(2);
  });

  it('stops at a gap', () => {
    const completions = { '1': [daysAgoISO(0), daysAgoISO(2)] };
    expect(getStreak(completions)).toBe(1);
  });
});

describe('getCompletionDateMap', () => {
  it('groups sessions by day, sorted chronologically within a day', () => {
    const exercises = [{ id: 1, name: 'Test exercise' }];
    const completions = {
      '1': [
        new Date('2026-07-02T14:00:00').toISOString(),
        new Date('2026-07-02T08:00:00').toISOString(),
        daysAgoISO(1),
      ],
    };
    const map = getCompletionDateMap(completions, exercises);
    const today = map.get('2026-07-02');
    expect(today).toHaveLength(2);
    expect(today[0].time < today[1].time || today[0].sortMs < today[1].sortMs).toBe(true);
    expect(today[0].name).toBe('Test exercise');
    expect(map.get('2026-07-01')).toHaveLength(1);
  });
});
