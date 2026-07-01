import { exercises } from '../data/exercises.js';
import { dateKey } from '../utils/tracker.js';
import { useSwipe } from '../utils/useSwipe.js';
import { CheckIcon } from './Icons.jsx';

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

function dayDoneFraction(date, completions) {
  const key = dateKey(date);
  const doneCount = exercises.reduce((count, ex) => {
    const hist = completions[String(ex.id)] || [];
    return count + (hist.some((iso) => dateKey(new Date(iso)) === key) ? 1 : 0);
  }, 0);
  return doneCount / exercises.length;
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
        const fraction = dayDoneFraction(date, completions);
        const isDone = fraction >= 1;
        const angle = Math.min(fraction, 1) * 360;

        return (
          <button
            key={key}
            className={`week-day ${isSelected ? 'is-selected' : ''}`}
            onClick={() => onSelectDate(key)}
          >
            <span className="week-day-label">{WEEKDAY_LABELS[i]}</span>
            <span
              className={`week-day-ring ${isDone ? 'is-done' : ''} ${isToday ? 'is-today' : ''}`}
              style={!isDone ? { background: `conic-gradient(var(--success) ${angle}deg, var(--border) 0deg)` } : undefined}
            >
              <span className="week-day-ring-hole">
                {isDone ? <CheckIcon size={13} /> : date.getDate()}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
