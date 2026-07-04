import { useMemo, useState } from 'react';
import ProgressRing from './ProgressRing.jsx';
import MonthCalendar from './MonthCalendar.jsx';
import DayLogList from './DayLogList.jsx';
import { CheckCircleIcon, FlameIcon } from './Icons.jsx';
import { exercises } from '../data/exercises.js';
import { formatDateLong } from '../utils/format.js';
import { getTotalSessions, getStreak, getPlanProgressOn, getDayEntries } from '../utils/tracker.js';

export default function ProgressView({ completions, plans, todayModel, onOpenExercise }) {
  const { dateMap, planTotal, planDone, bonusDone } = todayModel;
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState(null);

  const totalSessions = useMemo(() => getTotalSessions(completions), [completions]);
  const streak = useMemo(() => getStreak(completions), [completions]);

  // Group the selected day's sessions by exercise so each renders as one card
  // carrying how many times it was done and at what times, plus that day's
  // own plan stats.
  const day = useMemo(() => {
    if (!selectedDate) return null;
    const date = new Date(`${selectedDate}T12:00:00`);
    const entries = getDayEntries(exercises, completions, plans, date);
    const { planTotal: pt, planDone: pd, bonusDone: bd } = getPlanProgressOn(exercises, completions, date, plans);
    return { entries, date, planTotal: pt, planDone: pd, bonusDone: bd };
  }, [selectedDate, completions, plans]);

  return (
    <div className="progress-view">
      <div className="progress-hero">
        <ProgressRing value={planDone} max={planTotal} bonus={bonusDone} />
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

      {day && (
        <div className="day-detail">
          <div className="day-log-header">
            <p className="day-detail-title">{formatDateLong(selectedDate)}</p>
            {(day.planTotal > 0 || day.bonusDone > 0) && (
              <span className="day-log-stat">
                {day.planDone}/{day.planTotal} done
                {day.bonusDone > 0 && <span className="day-log-stat-extra"> · +{day.bonusDone} extra</span>}
              </span>
            )}
          </div>

          <DayLogList
            entries={day.entries}
            date={day.date}
            onOpenExercise={onOpenExercise}
            emptyMessage="Nothing planned or logged this day."
          />
        </div>
      )}
    </div>
  );
}
