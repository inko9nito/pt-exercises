import { useMemo, useState } from 'react';
import ProgressRing from './ProgressRing.jsx';
import MonthCalendar from './MonthCalendar.jsx';
import { CheckCircleIcon, CheckBadgeIcon, ChevronRightIcon, FlameIcon, StarIcon } from './Icons.jsx';
import { exercises, exerciseById } from '../data/exercises.js';
import { assetUrl } from '../utils/asset.js';
import { formatDateLong } from '../utils/format.js';
import {
  getTotalSessions,
  getStreak,
  getCompletionDateMap,
  getPlanProgress,
  getPlanProgressOn,
  isScheduledOn,
} from '../utils/tracker.js';

export default function ProgressView({ completions, onOpenExercise }) {
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState(null);

  const { planTotal, planDone, bonusDone } = useMemo(
    () => getPlanProgress(exercises, completions),
    [completions]
  );

  const totalSessions = useMemo(() => getTotalSessions(completions), [completions]);
  const streak = useMemo(() => getStreak(completions), [completions]);
  const dateMap = useMemo(() => getCompletionDateMap(completions, exercises), [completions]);

  // Group the selected day's sessions by exercise so each renders as one card
  // carrying how many times it was done and at what times, plus that day's
  // own plan stats.
  const day = useMemo(() => {
    if (!selectedDate) return null;
    const byId = new Map();
    for (const item of dateMap.get(selectedDate) || []) {
      if (!byId.has(item.id)) byId.set(item.id, { id: item.id, times: [] });
      byId.get(item.id).times.push(item.time);
    }
    const date = new Date(`${selectedDate}T12:00:00`);
    const { planTotal: pt, planDone: pd, bonusDone: bd } = getPlanProgressOn(exercises, completions, date);
    return { cards: Array.from(byId.values()), date, planTotal: pt, planDone: pd, bonusDone: bd };
  }, [selectedDate, dateMap, completions]);

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

          {day.cards.length > 0 ? (
            <div className="row-group">
              {day.cards.map((card) => {
                const ex = exerciseById.get(card.id);
                if (!ex) return null;
                const extra = !isScheduledOn(ex, completions, day.date);
                return (
                  <button
                    key={card.id}
                    className="exercise-row"
                    onClick={() => onOpenExercise && onOpenExercise(ex, day.date)}
                  >
                    <span className="row-thumb">
                      <img src={assetUrl(ex.images[0])} alt="" loading="lazy" />
                    </span>
                    <span className="row-body">
                      <span className="row-name">{ex.name}</span>
                      <span className="row-meta">
                        {card.times.length > 1
                          ? `${card.times.length}× · ${card.times.join(', ')}`
                          : `Done ${card.times[0]}`}
                      </span>
                    </span>
                    {extra && (
                      <span className="row-extra-badge">
                        <StarIcon size={11} />
                        Extra
                      </span>
                    )}
                    <span className="row-status-check">
                      <CheckBadgeIcon size={21} />
                    </span>
                    <span className="row-chevron">
                      <ChevronRightIcon size={18} />
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="day-detail-empty">No exercises logged this day.</p>
          )}
        </div>
      )}
    </div>
  );
}
