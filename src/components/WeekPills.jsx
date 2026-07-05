import { memo } from 'react';
import { CheckIcon } from './Icons.jsx';
import { dateKey, WEEKDAY_LABELS } from '../utils/tracker.js';

// The week-mode header strip: one tall pill per day (Mon–Sun). A day with any
// logged session fills solid with a check; days without stay hollow; days
// still in the future read as muted. Purely a status display — the day-by-day
// log below is where the detail lives (mirrors the Fitbit reference in #82).
function WeekPills({ days, dateMap, today }) {
  const todayKey = dateKey(today);
  return (
    <div className="week-pills">
      {days.map((date, i) => {
        const key = dateKey(date);
        const active = (dateMap.get(key)?.length ?? 0) > 0;
        const isFuture = key > todayKey;
        const isToday = key === todayKey;
        return (
          <div key={key} className="week-pill-col">
            <span
              className={`week-pill ${active ? 'is-active' : ''} ${isFuture ? 'is-future' : ''} ${
                isToday ? 'is-today' : ''
              }`}
            >
              {active && <CheckIcon size={16} />}
            </span>
            <span className="week-pill-label">{WEEKDAY_LABELS[i][0]}</span>
          </div>
        );
      })}
    </div>
  );
}

export default memo(WeekPills);
