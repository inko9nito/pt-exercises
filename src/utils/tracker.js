import { FREQ } from '../data/exercises.js';

const STORAGE_KEY = 'domino_completions';

// Firebase RTDB can hand back null for a per-exercise history that's been
// emptied out entirely (e.g. every session for it was undone) rather than
// [], and that malformed shape gets persisted to localStorage via
// saveCompletions() just like anything else — so this needs to run on data
// coming from either source, not just fresh Firebase snapshots.
export function normalizeCompletions(raw) {
  const normalized = {};
  for (const [id, history] of Object.entries(raw || {})) {
    normalized[id] = Array.isArray(history) ? history : [];
  }
  return normalized;
}

export function loadCompletions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return normalizeCompletions(raw ? JSON.parse(raw) : {});
  } catch {
    return {};
  }
}

export function saveCompletions(completions) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(completions));
}

export function markDone(completions, exerciseId) {
  const id = String(exerciseId);
  const prev = completions[id] || [];
  return { ...completions, [id]: [...prev, new Date().toISOString()] };
}

// Retroactively log a session on a past day (for something that was done but
// forgotten). Stamped at local noon since the exact time doesn't matter, and
// the history is kept chronologically sorted so "last done" (history's last
// element) stays the most recent session even after a back-dated insert.
export function markDoneOn(completions, exerciseId, date) {
  const id = String(exerciseId);
  const prev = completions[id] || [];
  const stamp = new Date(date);
  stamp.setHours(12, 0, 0, 0);
  const next = [...prev, stamp.toISOString()].sort();
  return { ...completions, [id]: next };
}

// Remove a single logged session on a specific day (the most recent one that
// day). Used both for the exercise-detail "Undo" (scoped to today, so it can
// never reach back and delete a prior day's session — see issue #43) and for
// reviewing a past day's log and pulling out an entry.
export function removeSessionOn(completions, exerciseId, date) {
  const id = String(exerciseId);
  const history = completions[id] || [];
  const key = dateKey(date);
  let idx = -1;
  for (let i = history.length - 1; i >= 0; i--) {
    if (dateKey(new Date(history[i])) === key) {
      idx = i;
      break;
    }
  }
  if (idx === -1) return completions;
  return { ...completions, [id]: [...history.slice(0, idx), ...history.slice(idx + 1)] };
}

export function countSessionsOn(completions, exerciseId, date) {
  const key = dateKey(date);
  return (completions[String(exerciseId)] || []).filter((iso) => dateKey(new Date(iso)) === key).length;
}

export function daysBetween(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
}

export function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Date.getDay() is Sunday-start (0 = Sunday); every calendar view in this app
// (week strip, month calendar) starts the week on Monday instead.
export function mondayIndex(date) {
  return (date.getDay() + 6) % 7;
}

export function isToday(isoString) {
  return dateKey(new Date(isoString)) === dateKey(new Date());
}

export function isDueToday(exercise, completions) {
  const id = String(exercise.id);
  const history = completions[id] || [];
  const today = new Date();

  switch (exercise.freqType) {
    case FREQ.DAILY:
    case FREQ.DAILY_OR_EOD: {
      return !history.some(isToday);
    }

    case FREQ.EVERY_OTHER_DAY:
    case FREQ.EVERY_3_DAYS:
    case FREQ.TWICE_WEEKLY: {
      if (history.length === 0) return true;
      const last = history[history.length - 1];
      return daysBetween(last, today) >= exercise.freqDays;
    }

    case FREQ.MULTIPLE_DAILY: {
      const todayCount = history.filter(isToday).length;
      return todayCount < (exercise.maxPerDay || 3);
    }

    case FREQ.HOURLY: {
      if (exercise.dailyTarget) {
        const todayCount = history.filter(isToday).length;
        if (todayCount >= exercise.dailyTarget) return false;
      }
      if (history.length === 0) return true;
      const last = new Date(history[history.length - 1]);
      const minutesSince = (today - last) / (1000 * 60);
      return minutesSince >= (exercise.freqMinutes || 90);
    }

    case FREQ.AS_NEEDED:
    default:
      return true;
  }
}

// "Daily to every other day" exercises are only optional on a given day if
// they were done the day before — skipping today still keeps the every-other-day
// minimum, whereas skipping two days in a row would not.
export function isOptionalToday(exercise, completions) {
  if (exercise.freqType !== FREQ.DAILY_OR_EOD) return false;
  const id = String(exercise.id);
  const history = completions[id] || [];
  if (history.length === 0) return false;
  if (history.some(isToday)) return false;
  const last = history[history.length - 1];
  return daysBetween(last, new Date()) === 1;
}

// For "every 1-2 hours" exercises, estimate when it'll be due again so the
// UI can show "next due ~2:45 PM" instead of leaving the gap unexplained.
export function getNextDueEstimate(exercise, completions) {
  if (exercise.freqType !== FREQ.HOURLY) return null;
  const id = String(exercise.id);
  const history = completions[id] || [];
  if (history.length === 0) return null;
  if (exercise.dailyTarget && history.filter(isToday).length >= exercise.dailyTarget) return null;
  const last = new Date(history[history.length - 1]);
  const next = new Date(last.getTime() + (exercise.freqMinutes || 90) * 60000);
  if (next <= new Date()) return null;
  return next;
}

// Whether an exercise shows up anywhere on today's page at all — due,
// optional, or already completed today. Drives which rows render on the
// Today tab and which exercises the "Log another exercise" picker offers
// (everything NOT relevant today). This is deliberately broader than the
// progress *plan* below: an optional or a bonus-logged exercise is shown,
// but it isn't part of the prescribed plan.
export function isRelevantToday(exercise, completions) {
  if (exercise.freqType === FREQ.AS_NEEDED || exercise.freqType === FREQ.MULTIPLE_DAILY) return true;
  if (isDueToday(exercise, completions)) return true;
  const hist = completions[String(exercise.id)] || [];
  return hist.some(isToday);
}

// Whether an exercise is part of today's *prescribed plan* — independent of
// whether it's already been done today. This is the honest denominator for
// the progress ring: doing a bonus/unscheduled exercise must never inflate
// the plan, and completing a scheduled one must never shrink it out of the
// plan. The distinction plain isDueToday can't make is that a daily
// exercise stops being "due" the moment it's done, yet it was still on
// that day's plan — so scheduling is computed only from sessions on *other*
// days, which also lets it be reconstructed for any past day (the week
// strip's per-day rings) purely from history.
function sessionsBefore(history, date) {
  const key = dateKey(date);
  return history.filter((iso) => dateKey(new Date(iso)) < key);
}

function doneOn(history, date) {
  const key = dateKey(date);
  return history.some((iso) => dateKey(new Date(iso)) === key);
}

export function isScheduledOn(exercise, completions, date) {
  const history = completions[String(exercise.id)] || [];

  switch (exercise.freqType) {
    case FREQ.DAILY:
    case FREQ.MULTIPLE_DAILY:
    case FREQ.HOURLY:
      // Part of every day's routine; counts as plan-done once it's had at
      // least one session that day.
      return true;

    case FREQ.DAILY_OR_EOD: {
      // Baseline is daily, but doing it the day before already satisfies the
      // every-other-day floor and makes this day genuinely optional — not
      // part of the plan (doing it anyway is bonus).
      const prev = new Date(date);
      prev.setDate(prev.getDate() - 1);
      return !doneOn(history, prev);
    }

    case FREQ.EVERY_OTHER_DAY:
    case FREQ.EVERY_3_DAYS:
    case FREQ.TWICE_WEEKLY: {
      // Due on this day if the last session *before* it is at least the
      // cadence gap back (or there was none yet).
      const prior = sessionsBefore(history, date);
      if (prior.length === 0) return true;
      const last = prior[prior.length - 1];
      return daysBetween(last, date) >= exercise.freqDays;
    }

    case FREQ.AS_NEEDED:
    default:
      // Never a prescribed obligation — any session is bonus/extra credit.
      return false;
  }
}

export function isScheduledToday(exercise, completions) {
  return isScheduledOn(exercise, completions, new Date());
}

// Splits a given day's activity into two non-fungible currencies:
//   planTotal  — exercises prescribed that day (independent of completion)
//   planDone   — how many of those are done (never exceeds planTotal, so a
//                ring can't overflow on scheduled work and the "flourish" is
//                earned only by actually finishing the plan)
//   bonusDone  — exercises done that day that were NOT on the plan (optional
//                or unscheduled/"logged another"), surfaced separately so
//                extra work is visible without silently papering over a
//                skipped scheduled exercise.
export function getPlanProgressOn(exercises, completions, date) {
  let planTotal = 0;
  let planDone = 0;
  let bonusDone = 0;
  for (const ex of exercises) {
    const done = doneOn(completions[String(ex.id)] || [], date);
    if (isScheduledOn(ex, completions, date)) {
      planTotal += 1;
      if (done) planDone += 1;
    } else if (done) {
      bonusDone += 1;
    }
  }
  return { planTotal, planDone, bonusDone };
}

export function getPlanProgress(exercises, completions) {
  return getPlanProgressOn(exercises, completions, new Date());
}

// How many days past its due date a currently-due exercise is (0 = due today
// / on time, or not applicable). Counts consecutive prior days — starting
// yesterday — on which it was scheduled and not done; for interval exercises
// that equals the number of days since its due date. Exercises never done
// before today have no baseline to measure from, so they return 0 rather
// than an astronomically large count. Multiple-daily/hourly reset each day
// and as-needed is never owed, so they never accrue overdue days.
export function getDaysOverdue(exercise, completions) {
  if (
    exercise.freqType === FREQ.MULTIPLE_DAILY ||
    exercise.freqType === FREQ.HOURLY ||
    exercise.freqType === FREQ.AS_NEEDED
  ) {
    return 0;
  }
  const history = completions[String(exercise.id)] || [];
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  if (!history.some((iso) => new Date(iso) < startOfToday)) return 0;

  let count = 0;
  const cursor = new Date();
  for (let i = 0; i < 365; i++) {
    cursor.setDate(cursor.getDate() - 1);
    if (isScheduledOn(exercise, completions, cursor) && !doneOn(history, cursor)) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

export function getTodayCount(exercise, completions) {
  const id = String(exercise.id);
  const history = completions[id] || [];
  return history.filter(isToday).length;
}

export function getLastDone(exercise, completions) {
  const id = String(exercise.id);
  const history = completions[id] || [];
  if (history.length === 0) return null;
  return new Date(history[history.length - 1]);
}

export function getTotalSessions(completions) {
  // Firebase RTDB can hand back null for a history that's been emptied out
  // (e.g. every session for that exercise was undone) rather than [], so
  // this can't assume every value is an array.
  return Object.values(completions).reduce((sum, arr) => sum + (arr || []).length, 0);
}

export function getStreak(completions) {
  const dates = new Set();
  for (const arr of Object.values(completions)) {
    for (const iso of arr || []) dates.add(dateKey(new Date(iso)));
  }

  const cursor = new Date();
  if (!dates.has(dateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  while (dates.has(dateKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function getCompletionDateMap(completions, exercises) {
  const map = new Map();
  for (const ex of exercises) {
    const history = completions[String(ex.id)] || [];
    for (const iso of history) {
      const d = new Date(iso);
      const key = dateKey(d);
      const entry = {
        id: ex.id,
        name: ex.name,
        time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sortMs: d.getTime(),
      };
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(entry);
    }
  }
  for (const arr of map.values()) {
    arr.sort((a, b) => a.sortMs - b.sortMs);
  }
  return map;
}
