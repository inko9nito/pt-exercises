import { FREQ } from '../data/exercises.js';

const STORAGE_KEY = 'domino_completions';

export function loadCompletions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
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

function daysBetween(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
}

function isToday(isoString) {
  const d = new Date(isoString);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
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
