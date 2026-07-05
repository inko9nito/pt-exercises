import { memo } from 'react';
import { dateKey, mondayIndex, WEEKDAY_LABELS } from '../utils/tracker.js';

function getMonthCells(year, month) {
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = mondayIndex(firstOfMonth);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// Split out and memoized on primitives (not the `dateMap` object, which gets
// a new reference on every completions change even when most days' activity
// is unaffected) so logging a session only re-renders the day(s) whose own
// activity/selection actually changed, not all ~42 cells.
function CalendarCell({ dateKeyValue, dayNumber, hasActivity, isToday, isSelected, isFuture, onSelect }) {
  const classes = ['calendar-cell'];
  if (hasActivity) classes.push('has-activity');
  if (isToday) classes.push('is-today');
  if (isSelected) classes.push('is-selected');

  return (
    <button
      className={classes.join(' ')}
      disabled={isFuture}
      onClick={() => onSelect(isSelected ? null : dateKeyValue)}
    >
      {/* Fixed size, smaller than the grid cell (rather than the cell itself
          being the circle), so adjacent active days keep visible space
          between their circles instead of touching edge-to-edge. */}
      <span className="calendar-day-num">{dayNumber}</span>
    </button>
  );
}

const MemoCalendarCell = memo(CalendarCell);

// Headerless month grid: the enclosing view owns the month label and
// prev/next navigation (shared with the week view's period nav in #82), so
// this renders only the weekday row and the day cells for the given
// year/month.
export default function MonthCalendar({ year, month, dateMap, selectedDate, onSelectDate }) {
  const cells = getMonthCells(year, month);
  const today = new Date();
  const todayKey = dateKey(today);

  return (
    <div className="calendar-card">
      <div className="calendar-weekdays">
        {WEEKDAY_LABELS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      <div className="calendar-grid">
        {cells.map((date, i) => {
          if (!date) return <span key={i} className="calendar-cell empty" />;

          const key = dateKey(date);

          return (
            <MemoCalendarCell
              key={i}
              dateKeyValue={key}
              dayNumber={date.getDate()}
              hasActivity={dateMap.has(key)}
              isToday={key === todayKey}
              isSelected={key === selectedDate}
              isFuture={date > today}
              onSelect={onSelectDate}
            />
          );
        })}
      </div>
    </div>
  );
}
