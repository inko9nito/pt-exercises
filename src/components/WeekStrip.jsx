import { memo, useMemo } from 'react';
import { exercises } from '../data/exercises.js';
import { dateKey, getPlanProgressOn, mondayIndex, WEEKDAY_LABELS } from '../utils/tracker.js';
import { useSwipe } from '../utils/useSwipe.js';
import { CheckIcon, StarIcon } from './Icons.jsx';

function getWeekDates(weekOffset) {
  const today = new Date();
  const monday = new Date(today);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(today.getDate() - mondayIndex(today) + weekOffset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

// Split out and memoized on primitives (not the Date object) so logging one
// exercise — which changes `completions` and forces every day's
// getPlanProgressOn to recompute in the parent — only re-renders the day(s)
// whose actual ring/label values changed, not all 7.
function WeekDay({ dateKeyValue, label, dayNumber, isToday, isSelected, planTotal, planDone, bonusDone, onSelect }) {
  const fraction = planTotal > 0 ? planDone / planTotal : 0;
  const isDone = planTotal > 0 && planDone >= planTotal;
  const hasBonus = bonusDone > 0;
  const angle = Math.min(fraction, 1) * 360;

  return (
    <button className={`week-day ${isSelected ? 'is-selected' : ''}`} onClick={() => onSelect(dateKeyValue)}>
      <span className={`week-day-label ${isSelected ? 'is-selected' : ''} ${isToday ? 'is-today' : ''}`}>
        {label}
      </span>
      <span
        className={`week-day-ring ${isDone ? 'is-done' : ''}`}
        style={!isDone ? { background: `conic-gradient(var(--success) ${angle}deg, var(--border) 0deg)` } : undefined}
      >
        <span className={`week-day-ring-hole ${isToday ? 'is-today' : ''}`}>
          {isDone ? <CheckIcon size={13} /> : dayNumber}
        </span>
        {hasBonus && (
          <span className="week-day-bonus-star" aria-label="Extra exercise logged">
            <StarIcon size={12} />
          </span>
        )}
      </span>
    </button>
  );
}

const MemoWeekDay = memo(WeekDay);

export default function WeekStrip({ selectedDate, onSelectDate, weekOffset, onWeekChange, completions, plans }) {
  const todayKey = dateKey(new Date());
  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);

  const swipeHandlers = useSwipe({
    onSwipeLeft: () => onWeekChange(weekOffset + 1),
    onSwipeRight: () => onWeekChange(weekOffset - 1),
  });

  return (
    <div className="week-strip" {...swipeHandlers}>
      {weekDates.map((date, i) => {
        const key = dateKey(date);
        // Each day's ring fills against *that day's own plan* (reconstructed
        // from history), not the whole 20-exercise library — otherwise a
        // fully-completed day where only a handful were due reads as barely
        // started. Bonus/extra work can't fill the ring (that's the
        // non-fungible plan-vs-bonus rule), so it gets its own corner dot so
        // a day with extra sessions doesn't look identical to an empty one.
        const { planTotal, planDone, bonusDone } = getPlanProgressOn(exercises, completions, date, plans);

        return (
          <MemoWeekDay
            key={key}
            dateKeyValue={key}
            label={WEEKDAY_LABELS[i]}
            dayNumber={date.getDate()}
            isToday={key === todayKey}
            isSelected={key === selectedDate}
            planTotal={planTotal}
            planDone={planDone}
            bonusDone={bonusDone}
            onSelect={onSelectDate}
          />
        );
      })}
    </div>
  );
}
