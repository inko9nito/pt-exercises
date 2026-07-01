import { exercises } from '../data/exercises.js';
import { dateKey, getPlanProgressOn } from '../utils/tracker.js';
import { useSwipe } from '../utils/useSwipe.js';
import { CheckIcon, StarIcon } from './Icons.jsx';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getWeekDates(weekOffset) {
  const today = new Date();
  const mondayIndex = (today.getDay() + 6) % 7; // Monday-start index
  const monday = new Date(today);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(today.getDate() - mondayIndex + weekOffset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

export default function WeekStrip({ selectedDate, onSelectDate, weekOffset, onWeekChange, completions }) {
  const todayKey = dateKey(new Date());
  const weekDates = getWeekDates(weekOffset);

  const swipeHandlers = useSwipe({
    onSwipeLeft: () => onWeekChange(weekOffset + 1),
    onSwipeRight: () => onWeekChange(weekOffset - 1),
  });

  return (
    <div className="week-strip" {...swipeHandlers}>
      {weekDates.map((date, i) => {
        const key = dateKey(date);
        const isToday = key === todayKey;
        const isSelected = key === selectedDate;
        // Each day's ring fills against *that day's own plan* (reconstructed
        // from history), not the whole 20-exercise library — otherwise a
        // fully-completed day where only a handful were due reads as barely
        // started. Bonus/extra work can't fill the ring (that's the
        // non-fungible plan-vs-bonus rule), so it gets its own corner dot so
        // a day with extra sessions doesn't look identical to an empty one.
        const { planTotal, planDone, bonusDone } = getPlanProgressOn(exercises, completions, date);
        const fraction = planTotal > 0 ? planDone / planTotal : 0;
        const isDone = planTotal > 0 && planDone >= planTotal;
        const hasBonus = bonusDone > 0;
        const angle = Math.min(fraction, 1) * 360;

        return (
          <button
            key={key}
            className={`week-day ${isSelected ? 'is-selected' : ''}`}
            onClick={() => onSelectDate(key)}
          >
            <span
              className={`week-day-label ${isSelected ? 'is-selected' : ''} ${isToday ? 'is-today' : ''}`}
            >
              {WEEKDAY_LABELS[i]}
            </span>
            <span
              className={`week-day-ring ${isDone ? 'is-done' : ''}`}
              style={!isDone ? { background: `conic-gradient(var(--success) ${angle}deg, var(--border) 0deg)` } : undefined}
            >
              <span className="week-day-ring-hole">
                {isDone ? <CheckIcon size={13} /> : date.getDate()}
              </span>
              {hasBonus && (
                <span className="week-day-bonus-star" aria-label="Extra exercise logged">
                  <StarIcon size={12} />
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
