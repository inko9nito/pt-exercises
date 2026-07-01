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

export function undoLast(completions, exerciseId) {
  const id = String(exerciseId);
  const prev = completions[id] || [];
  if (prev.length === 0) return completions;
  return { ...completions, [id]: prev.slice(0, -1) };
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

export function formatLastDone(date) {
  if (!date) return 'Never';
  if (isToday(date.toISOString())) {
    return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth()
  ) {
    return 'Yesterday';
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
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
