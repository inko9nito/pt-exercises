import { memo } from 'react';
import { CheckIcon, StarIcon } from './Icons.jsx';
import { exercises } from '../data/exercises.js';
import { dateKey, getPlanProgressOn, WEEKDAY_LABELS } from '../utils/tracker.js';
import { weekDates } from '../utils/progressStats.js';
import { useWeekSwipeTrack } from '../utils/useWeekSwipeTrack.js';

// The week-mode header strip. Deliberately mirrors WeekStrip's day cell (ring
// fill + bonus star) rather than the flat checkmark bars from the Fitbit
// reference in #82 — the app already has its own "how a day's completion
// looks" language, and this is the same underlying data (that day's plan
// progress), so it should read the same way here as it does on the Today tab.
function WeekPillDay({ label, dayNumber, planTotal, planDone, bonusDone, isToday, isFuture }) {
  const fraction = planTotal > 0 ? planDone / planTotal : 0;
  const isDone = planTotal > 0 && planDone >= planTotal;
  const hasBonus = bonusDone > 0;
  const angle = Math.min(fraction, 1) * 360;

  return (
    <div className={`week-day ${isFuture ? 'is-future' : ''}`}>
      <span className={`week-day-label ${isToday ? 'is-today' : ''}`}>{label}</span>
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
    </div>
  );
}

const MemoWeekPillDay = memo(WeekPillDay);

function WeekPills({ weekOffset, onWeekChange, canGoNext, completions, plans, today }) {
  const todayKey = dateKey(today);
  const { trackProps, trackStyle, onTransitionEnd } = useWeekSwipeTrack(weekOffset, onWeekChange, canGoNext);

  const renderWeek = (offset) =>
    weekDates(offset, today).map((date, i) => {
      const key = dateKey(date);
      const { planTotal, planDone, bonusDone } = getPlanProgressOn(exercises, completions, date, plans);
      return (
        <MemoWeekPillDay
          key={key}
          label={WEEKDAY_LABELS[i]}
          dayNumber={date.getDate()}
          planTotal={planTotal}
          planDone={planDone}
          bonusDone={bonusDone}
          isToday={key === todayKey}
          isFuture={key > todayKey}
        />
      );
    });

  return (
    <div className="week-track-viewport" {...trackProps}>
      <div className="week-track" style={trackStyle} onTransitionEnd={onTransitionEnd}>
        <div className="week-strip">{renderWeek(weekOffset - 1)}</div>
        <div className="week-strip">{renderWeek(weekOffset)}</div>
        <div className="week-strip">{renderWeek(weekOffset + 1)}</div>
      </div>
    </div>
  );
}

export default memo(WeekPills);
