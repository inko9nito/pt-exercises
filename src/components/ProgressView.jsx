import { useMemo, useState } from 'react';
import ProgressRing from './ProgressRing.jsx';
import MonthCalendar from './MonthCalendar.jsx';
import { CheckCircleIcon, FlameIcon } from './Icons.jsx';
import { exercises } from '../data/exercises.js';
import {
  isToday,
  getTotalSessions,
  getStreak,
  getCompletionDateMap,
  getRelevantTodayCount,
} from '../utils/tracker.js';

function formatDateLong(key) {
  const date = new Date(`${key}T00:00:00`);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export default function ProgressView({ completions }) {
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState(null);

  const doneToday = useMemo(
    () =>
      exercises.filter((ex) => (completions[String(ex.id)] || []).some(isToday)).length,
    [completions]
  );
  const relevantToday = useMemo(() => getRelevantTodayCount(exercises, completions), [completions]);

  const totalSessions = useMemo(() => getTotalSessions(completions), [completions]);
  const streak = useMemo(() => getStreak(completions), [completions]);
  const dateMap = useMemo(() => getCompletionDateMap(completions, exercises), [completions]);

  const selectedDayItems = selectedDate ? dateMap.get(selectedDate) || [] : null;

  return (
    <div className="progress-view">
      <div className="progress-hero">
        <ProgressRing value={doneToday} max={relevantToday} />
        <div className="progress-stats">
          <div className="stat-card">
            <span className="stat-icon stat-icon-mint">
              <CheckCircleIcon size={18} />
            </span>
            <span className="stat-value">{totalSessions}</span>
            <span className="stat-label">Total sessions</span>
          </div>
          <div className="stat-card">
            <span className="stat-icon stat-icon-amber">
              <FlameIcon size={18} />
            </span>
            <span className="stat-value">{streak}</span>
            <span className="stat-label">Day streak</span>
          </div>
        </div>
      </div>

      <MonthCalendar
        monthOffset={monthOffset}
        onMonthChange={setMonthOffset}
        dateMap={dateMap}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
      />

      {selectedDate && (
        <div className="day-detail">
          <p className="day-detail-title">{formatDateLong(selectedDate)}</p>
          {selectedDayItems && selectedDayItems.length > 0 ? (
            <div className="day-detail-list">
              {selectedDayItems.map((item, i) => (
                <div key={i} className="day-detail-item">
                  <span className="day-detail-name">{item.name}</span>
                  <span className="day-detail-time">{item.time}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="day-detail-empty">No exercises logged this day.</p>
          )}
        </div>
      )}
    </div>
  );
}
