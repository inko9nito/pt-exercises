import { ChevronLeftIcon, ChevronRightIcon } from './Icons.jsx';
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

export default function MonthCalendar({ monthOffset, onMonthChange, dateMap, selectedDate, onSelectDate }) {
  const base = new Date();
  base.setDate(1);
  base.setMonth(base.getMonth() + monthOffset);
  const year = base.getFullYear();
  const month = base.getMonth();

  const cells = getMonthCells(year, month);
  const monthLabel = base.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const today = new Date();
  const todayKey = dateKey(today);

  return (
    <div className="calendar-card">
      <div className="calendar-header">
        <button
          className="calendar-nav"
          onClick={() => onMonthChange(monthOffset - 1)}
          aria-label="Previous month"
        >
          <ChevronLeftIcon size={18} />
        </button>
        <span className="calendar-month-label">{monthLabel}</span>
        <button
          className="calendar-nav"
          onClick={() => onMonthChange(monthOffset + 1)}
          disabled={monthOffset >= 0}
          aria-label="Next month"
        >
          <ChevronRightIcon size={18} />
        </button>
      </div>

      <div className="calendar-weekdays">
        {WEEKDAY_LABELS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      <div className="calendar-grid">
        {cells.map((date, i) => {
          if (!date) return <span key={i} className="calendar-cell empty" />;

          const key = dateKey(date);
          const hasActivity = dateMap.has(key);
          const isCellToday = key === todayKey;
          const isSelected = key === selectedDate;
          const isFuture = date > today;

          const classes = ['calendar-cell'];
          if (hasActivity) classes.push('has-activity');
          if (isCellToday) classes.push('is-today');
          if (isSelected) classes.push('is-selected');

          return (
            <button
              key={i}
              className={classes.join(' ')}
              disabled={isFuture}
              onClick={() => onSelectDate(isSelected ? null : key)}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
