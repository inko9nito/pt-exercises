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
  groupDayCards,
  getSessionsOn,
  countSessionsOn,
  shouldTrustRemoteSnapshot,
  dateKey,
  planTarget,
  buildPlanSnapshot,
  missingPlanDays,
  isExtraOn,
  normalizePlans,
  getDayEntries,
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

describe('groupDayCards', () => {
  it('groups a day\'s sessions into one card per exercise, times in order', () => {
    const exercises = [
      { id: 1, name: 'Belly lift' },
      { id: 2, name: 'Bicycling hind leg' },
    ];
    const completions = {
      '1': [new Date('2026-07-02T08:00:00').toISOString(), new Date('2026-07-02T14:00:00').toISOString()],
      '2': [new Date('2026-07-02T10:00:00').toISOString()],
    };
    const dateMap = getCompletionDateMap(completions, exercises);
    const cards = groupDayCards(dateMap, '2026-07-02');
    expect(cards).toHaveLength(2);
    const bellyLift = cards.find((c) => c.id === 1);
    expect(bellyLift.times).toHaveLength(2);
  });

  it('returns an empty array for a day with no sessions', () => {
    const dateMap = getCompletionDateMap({}, []);
    expect(groupDayCards(dateMap, '2026-07-02')).toEqual([]);
  });
});

describe('getSessionsOn / countSessionsOn', () => {
  it('returns every session on the given day, in chronological order', () => {
    const first = new Date('2026-07-02T08:00:00').toISOString();
    const second = new Date('2026-07-02T14:00:00').toISOString();
    const completions = { '18': [daysAgoISO(1), first, second] };
    expect(getSessionsOn(completions, 18, NOW)).toEqual([first, second]);
    expect(countSessionsOn(completions, 18, NOW)).toBe(2);
  });

  it('returns an empty array/zero for a day with nothing logged', () => {
    expect(getSessionsOn({}, 18, NOW)).toEqual([]);
    expect(countSessionsOn({ '18': [daysAgoISO(5)] }, 18, NOW)).toBe(0);
  });
});

// Regression coverage for the history-index cache (B1/#41 PR4): the cache is
// keyed on the history *array reference*, since a completions update only
// replaces the edited exercise's array — every other exercise keeps its old
// reference (and cached index). These tests exercise both halves of that:
// an untouched exercise must still read correctly after a sibling changes,
// and an edited exercise's own cache must never return stale data.
describe('history index cache correctness', () => {
  it('reading one exercise is unaffected by a completions update to another', () => {
    const everyOtherDay = { id: 1, freqType: FREQ.EVERY_OTHER_DAY, freqDays: 2 };
    let completions = { '1': [daysAgoISO(2)], '2': [daysAgoISO(0)] };
    expect(isDueToday(everyOtherDay, completions)).toBe(true);

    // Simulate marking exercise 2 done again today — a real completions
    // update replaces only exercise 2's array; exercise 1's array reference
    // is untouched.
    completions = { ...completions, '2': [...completions['2'], daysAgoISO(0)] };
    expect(isDueToday(everyOtherDay, completions)).toBe(true);
  });

  it('reflects a new session on the same exercise once its array reference changes', () => {
    const everyOtherDay = { id: 3, freqType: FREQ.EVERY_OTHER_DAY, freqDays: 2 };
    let completions = { '3': [daysAgoISO(2)] };
    expect(isDueToday(everyOtherDay, completions)).toBe(true);

    // A fresh array reference for exercise 3, with today's session added —
    // must not read a stale cached index from the old array.
    completions = { '3': [...completions['3'], daysAgoISO(0)] };
    expect(isDueToday(everyOtherDay, completions)).toBe(false);
  });

  it('isScheduledOn finds the right prior session across multiple logged days', () => {
    const every3Days = { id: 4, freqType: FREQ.EVERY_3_DAYS, freqDays: 3 };
    // Logged on three different days; "last session before today" must be
    // the most recent of these (1 day ago), not the earliest.
    const completions = { '4': [daysAgoISO(5), daysAgoISO(3), daysAgoISO(1)] };
    // Last session 1 day ago, gap needed is 3 -> not yet due.
    expect(isScheduledOn(every3Days, completions, NOW)).toBe(false);
  });
});

// Regression coverage for the Firebase empty-snapshot-before-authoritative-
// payload race (#41 C4): onValue can deliver a placeholder empty snapshot
// right after a hard reload, before the real payload has synced. Rejecting
// it protects existing localStorage data from being stomped; once a real
// (non-empty) snapshot has been seen, later legitimate empty snapshots (e.g.
// every session was undone) must be trusted, not rejected forever.
describe('shouldTrustRemoteSnapshot', () => {
  it('rejects an empty snapshot before any real data has been seen', () => {
    expect(shouldTrustRemoteSnapshot({}, false)).toBe(false);
  });

  it('accepts a non-empty snapshot even before trust was established, and that establishes trust', () => {
    expect(shouldTrustRemoteSnapshot({ '1': [daysAgoISO(0)] }, false)).toBe(true);
  });

  it('accepts a later empty snapshot once trust has already been established', () => {
    expect(shouldTrustRemoteSnapshot({}, true)).toBe(true);
  });

  it('accepts a non-empty snapshot once trust has already been established', () => {
    expect(shouldTrustRemoteSnapshot({ '1': [daysAgoISO(0)] }, true)).toBe(true);
  });
});

// Plan snapshots (issue #53): a day's prescribed plan is a stored record, so
// past days stop being re-interpreted under today's frequency rules.
describe('planTarget', () => {
  it('is 1 for daily/interval, the cap for multiple-daily, the target for hourly', () => {
    expect(planTarget(dailyEx)).toBe(1);
    expect(planTarget(everyOtherDayEx)).toBe(1);
    expect(planTarget(multipleDailyEx)).toBe(3);
    expect(planTarget(hourlyEx)).toBe(8);
  });
});

describe('buildPlanSnapshot', () => {
  it('includes every scheduled exercise with its target and excludes as-needed', () => {
    const snap = buildPlanSnapshot(
      [dailyEx, multipleDailyEx, hourlyEx, asNeededEx],
      {},
      NOW,
      'live'
    );
    expect(snap.exercises).toEqual({
      '1': { target: 1 },
      '6': { target: 3 },
      '7': { target: 8 },
    });
    expect(snap.amendments).toEqual({});
    expect(snap.source).toBe('live');
    expect(snap.createdAt).toBeTruthy();
  });
});

describe('getPlanProgressOn with a stored snapshot', () => {
  const key = dateKey(NOW);

  it('reads the plan from the snapshot instead of reconstructing', () => {
    // Reconstruction would say everyOtherDay is scheduled today (no history),
    // but the recorded snapshot says nothing was planned — so a session that
    // day is bonus, not plan.
    const completions = { '3': [NOW.toISOString()] };
    const plans = { [key]: { exercises: {}, amendments: {}, source: 'live' } };
    expect(getPlanProgressOn([everyOtherDayEx], completions, NOW, plans)).toEqual({
      planTotal: 0,
      planDone: 0,
      bonusDone: 1,
    });
    // Same inputs without a snapshot fall back to reconstruction.
    expect(getPlanProgressOn([everyOtherDayEx], completions, NOW)).toEqual({
      planTotal: 1,
      planDone: 1,
      bonusDone: 0,
    });
  });

  it('counts a planned exercise as done only once it has a session that day', () => {
    const plans = { [key]: { exercises: { '1': { target: 1 } }, amendments: {} } };
    expect(getPlanProgressOn([dailyEx], {}, NOW, plans)).toMatchObject({
      planTotal: 1,
      planDone: 0,
    });
    expect(
      getPlanProgressOn([dailyEx], { '1': [NOW.toISOString()] }, NOW, plans)
    ).toMatchObject({ planTotal: 1, planDone: 1 });
  });

  it('skips a snapshot id that is no longer in the exercise library', () => {
    const plans = { [key]: { exercises: { '999': { target: 1 } }, amendments: {} } };
    expect(getPlanProgressOn([dailyEx], {}, NOW, plans)).toEqual({
      planTotal: 0,
      planDone: 0,
      bonusDone: 0,
    });
  });

  it('drops a postponed exercise from the plan denominator (schema room for #27)', () => {
    const plans = {
      [key]: {
        exercises: { '1': { target: 1 } },
        amendments: { postponed: { '1': '2026-07-03' } },
      },
    };
    expect(getPlanProgressOn([dailyEx], {}, NOW, plans)).toEqual({
      planTotal: 0,
      planDone: 0,
      bonusDone: 0,
    });
  });
});

describe('isExtraOn', () => {
  const key = dateKey(NOW);

  it('uses the snapshot when present', () => {
    const plans = { [key]: { exercises: { '1': { target: 1 } }, amendments: {} } };
    expect(isExtraOn(dailyEx, {}, NOW, plans)).toBe(false); // planned → not extra
    expect(isExtraOn(everyOtherDayEx, {}, NOW, plans)).toBe(true); // not planned → extra
  });

  it('falls back to reconstruction with no snapshot', () => {
    // as-needed is never scheduled, so a session is always extra.
    expect(isExtraOn(asNeededEx, {}, NOW)).toBe(true);
    expect(isExtraOn(dailyEx, {}, NOW)).toBe(false);
  });
});

describe('missingPlanDays', () => {
  it('lists earliest-completion..yesterday plus today, minus existing snapshots', () => {
    const completions = { '1': [daysAgoISO(2), daysAgoISO(0)] };
    const days = missingPlanDays(completions, {}, NOW);
    expect(days).toEqual([
      dateKey(new Date(daysAgoISO(2))),
      dateKey(new Date(daysAgoISO(1))), // gap day with no session still needs a plan
      dateKey(NOW),
    ]);
  });

  it('returns only today when there is no history', () => {
    expect(missingPlanDays({}, {}, NOW)).toEqual([dateKey(NOW)]);
  });

  it('is idempotent once every day already has a snapshot', () => {
    const completions = { '1': [daysAgoISO(1), daysAgoISO(0)] };
    const plans = {};
    for (const k of missingPlanDays(completions, {}, NOW)) {
      plans[k] = { exercises: {}, amendments: {}, source: 'backfilled' };
    }
    expect(missingPlanDays(completions, plans, NOW)).toEqual([]);
  });
});

describe('getDayEntries', () => {
  const day = new Date('2026-07-01T12:00:00');
  const key = dateKey(day);
  const named = [
    { ...dailyEx, name: 'Daily', freqLabel: 'Daily' },
    { ...everyOtherDayEx, name: 'EOD', freqLabel: 'Every other day' },
    { ...asNeededEx, name: 'AsNeeded', freqLabel: 'As needed' },
  ];

  it('shows planned exercises done or missed, plus extras, in that order', () => {
    // Snapshot: only the daily exercise was planned that day.
    const plans = { [key]: { exercises: { '1': { target: 1 } }, amendments: {} } };
    // Daily done; the as-needed one logged as a bonus; EOD not planned/not done.
    const completions = {
      '1': [new Date('2026-07-01T09:00:00').toISOString()],
      '8': [new Date('2026-07-01T10:00:00').toISOString()],
    };
    const entries = getDayEntries(named, completions, plans, day);
    expect(entries.map((e) => [e.name, e.done, e.extra])).toEqual([
      ['Daily', true, false], // planned + done
      ['AsNeeded', true, true], // extra (bonus)
    ]);
  });

  it('lists a planned-but-not-done exercise as missed', () => {
    const plans = { [key]: { exercises: { '1': { target: 1 } }, amendments: {} } };
    const entries = getDayEntries(named, {}, plans, day);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ name: 'Daily', done: false, extra: false });
  });

  it('falls back to reconstruction with no snapshot', () => {
    // No plans: daily + EOD are scheduled (reconstruction), as-needed is not.
    const entries = getDayEntries(named, {}, {}, day);
    const missed = entries.filter((e) => !e.done).map((e) => e.name);
    expect(missed).toEqual(['Daily', 'EOD']);
  });

  it('does not mark today (or future) planned exercises as missed', () => {
    // NOW is 2026-07-02; nothing done today, but the day isn't over.
    const entries = getDayEntries(named, {}, {}, new Date(NOW));
    expect(entries.filter((e) => !e.done)).toEqual([]);
  });
});

describe('normalizePlans', () => {
  it('fills default exercises/amendments and drops malformed entries', () => {
    const raw = {
      '2026-07-01': { source: 'backfilled', createdAt: 'x' }, // Firebase dropped empty objects
      '2026-07-02': { exercises: { '1': { target: 1 } } },
      '2026-07-03': null,
    };
    const out = normalizePlans(raw);
    expect(out['2026-07-01']).toEqual({
      exercises: {},
      amendments: {},
      source: 'backfilled',
      createdAt: 'x',
    });
    expect(out['2026-07-02'].amendments).toEqual({});
    expect(out['2026-07-02'].source).toBe('live'); // default when absent
    expect(out['2026-07-03']).toBeUndefined();
  });
});
