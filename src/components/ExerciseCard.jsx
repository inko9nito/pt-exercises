import { useState } from 'react';
import ImageCarousel from './ImageCarousel.jsx';
import Tags from './Tags.jsx';
import { formatLastDone } from '../utils/tracker.js';
import { FREQ } from '../data/exercises.js';

export default function ExerciseCard({
  exercise,
  completions,
  onMarkDone,
  onUndo,
  compact = false,
}) {
  const [expanded, setExpanded] = useState(false);

  const id = String(exercise.id);
  const history = completions[id] || [];
  const lastDoneDate = history.length > 0 ? new Date(history[history.length - 1]) : null;
  const lastDoneLabel = formatLastDone(lastDoneDate);

  const isToday = (iso) => {
    const d = new Date(iso);
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  };

  const todayCount = history.filter(isToday).length;
  const isHourly = exercise.freqType === FREQ.HOURLY;
  const isMultipleDaily = exercise.freqType === FREQ.MULTIPLE_DAILY;
  const maxPerDay = exercise.maxPerDay || 99;

  const doneToday = isMultipleDaily ? todayCount >= maxPerDay : todayCount > 0 && !isHourly;
  const showTodayBadge = todayCount > 0;

  const setsRepsText = [
    exercise.sets ? `Sets: ${exercise.sets}` : null,
    exercise.reps ? `Reps: ${exercise.reps}` : null,
  ]
    .filter(Boolean)
    .join('  ·  ');

  return (
    <div className={`exercise-card ${doneToday ? 'done' : ''}`}>
      <div className="card-header" onClick={() => setExpanded((v) => !v)}>
        <div className="card-title-row">
          <span className="exercise-number">{exercise.id}</span>
          <h3 className="exercise-name">{exercise.name}</h3>
          {showTodayBadge && (
            <span className="done-badge">
              {isMultipleDaily || isHourly ? `✓ ×${todayCount}` : '✓'}
            </span>
          )}
          <span className="expand-icon">{expanded ? '▲' : '▼'}</span>
        </div>
        <div className="card-meta">
          {setsRepsText && <span className="sets-reps">{setsRepsText}</span>}
        </div>
        <Tags exercise={exercise} />
      </div>

      {expanded && (
        <div className="card-body">
          <ImageCarousel images={exercise.images} alt={exercise.name} />
          <p className="exercise-description">{exercise.description}</p>
          <div className="last-done">
            Last done: <strong>{lastDoneLabel}</strong>
            {(isMultipleDaily || isHourly) && todayCount > 0 && (
              <> · Today: <strong>{todayCount}×</strong></>
            )}
          </div>
        </div>
      )}

      <div className="card-actions">
        <button
          className="btn-done"
          onClick={() => onMarkDone(exercise.id)}
        >
          Mark Done
        </button>
        {history.length > 0 && (
          <button className="btn-undo" onClick={() => onUndo(exercise.id)}>
            Undo
          </button>
        )}
      </div>
    </div>
  );
}
