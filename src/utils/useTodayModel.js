import { useMemo } from 'react';
import { exercises, FREQ } from '../data/exercises.js';
import {
  getTodayCount,
  isDueToday,
  isOptionalToday,
  isRelevantToday,
  getNextDueEstimate,
  getPlanProgress,
  getCompletionDateMap,
} from './tracker.js';

// Computes everything about "today" that both DailyView and ProgressView
// need from `completions` — the To do/Later today/Optional/Completed
// buckets, the plan-vs-bonus totals the progress ring and daily summary both
// read, which exercises aren't on today's page at all (for "Log another
// exercise"), and the completions grouped by day for past-day views. Called
// once in App, which persists across tab switches, so navigating between
// tabs doesn't force a fresh walk over `exercises` each time — only an
// actual `completions` change does.
export function useTodayModel(completions) {
  // Due/optional/not-due status is only meaningful for today — a past day's
  // view just shows what was actually logged then, which is what this
  // grouping is for.
  const dateMap = useMemo(() => getCompletionDateMap(completions, exercises), [completions]);

  const { due, laterToday, optional, completedToday, relevantIds } = useMemo(() => {
    const due = [];
    const laterToday = [];
    const optional = [];
    const completedToday = [];
    // isRelevantToday is the shared definition of "shows up somewhere on
    // today's page", also used by the Progress ring, so the two never drift.
    const relevantIds = new Set();

    for (const ex of exercises) {
      const todayCount = getTodayCount(ex, completions);
      const dueToday = isDueToday(ex, completions);
      const doneToday = todayCount > 0;

      if (ex.freqType === FREQ.AS_NEEDED) {
        // Never a real obligation — always available, never required.
        optional.push(ex);
      } else if (ex.freqType === FREQ.MULTIPLE_DAILY) {
        const maxPerDay = ex.maxPerDay || 99;
        // Same flow as an hourly exercise: the first session is "To do",
        // remaining sessions of the day live in "Later today" (spread the
        // reps out, don't do them all at once), and it's "Completed" only
        // once the daily count is met — the sessions are the plan, not a
        // bonus, so it never lands in Optional.
        if (todayCount === 0) due.push(ex);
        else if (todayCount < maxPerDay) laterToday.push(ex);
        else completedToday.push(ex);
      } else if (ex.freqType === FREQ.HOURLY) {
        // Recurs through the day. Surface it where the user actually looks:
        // "To do" when it's time again, "Later today" while cooling down
        // between sessions (so a pending session isn't buried in Completed),
        // and "Completed" only once the daily target is reached.
        if (dueToday) due.push(ex);
        else if (doneToday && getNextDueEstimate(ex, completions)) laterToday.push(ex);
        else if (doneToday) completedToday.push(ex);
      } else if (dueToday) {
        if (isOptionalToday(ex, completions)) optional.push(ex);
        else due.push(ex);
      } else if (doneToday) {
        completedToday.push(ex);
      }
      // Otherwise it's simply not due today — nothing to show here; it's
      // still visible any time in "All exercises".

      if (isRelevantToday(ex, completions)) relevantIds.add(ex.id);
    }

    return { due, laterToday, optional, completedToday, relevantIds };
  }, [completions]);

  // The one plan/bonus split both the Progress ring and the daily summary
  // read — computed once here instead of separately in each view, so the
  // two can't disagree about how much of today is "done".
  const { planTotal, planDone, bonusDone } = useMemo(
    () => getPlanProgress(exercises, completions),
    [completions]
  );

  // Exercises whose schedule doesn't put them on today's page at all (e.g.
  // every-3-days ones not due yet) — surfaced via "Log another exercise" so
  // an unscheduled session (vet visit, one-off extra rep) doesn't require
  // digging through the All Exercises tab to find.
  const notScheduledToday = useMemo(
    () => exercises.filter((ex) => !relevantIds.has(ex.id)),
    [relevantIds]
  );

  return {
    dateMap,
    due,
    laterToday,
    optional,
    completedToday,
    notScheduledToday,
    planTotal,
    planDone,
    bonusDone,
  };
}
