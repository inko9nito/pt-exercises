import { isToday } from './tracker.js';

// e.g. "2026-07-02" -> "Thursday, July 2" — used for day-detail headings
// (week strip's past-day view, Progress calendar's day-detail).
export function formatDateLong(key) {
  const date = new Date(`${key}T00:00:00`);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
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
