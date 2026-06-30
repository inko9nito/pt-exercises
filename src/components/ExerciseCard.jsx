import { useState } from 'react';
import ImageCarousel from './ImageCarousel.jsx';
import Tags from './Tags.jsx';
import { CheckIcon, ChevronDownIcon, UndoIcon } from './Icons.jsx';
import { formatLastDone } from '../utils/tracker.js';
import { FREQ } from '../data/exercises.js';

export default function ExerciseCard({ exercise, completions, onMarkDone, onUndo }) {
  const [expanded, setExpanded] = useState(false);

  const id = String(exercise.id);
  const history = completions[id] || [];

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
  const lastDoneDate = history.length > 0 ? new Date(history[history.length - 1]) : null;

  const isMultipleDaily = exercise.freqType === FREQ.MULTIPLE_DAILY;
  const isHourly = exercise.freqType === FREQ.HOURLY;
  const maxPerDay = exercise.maxPerDay || 99;

  const completedToday =
    isMultipleDaily ? todayCount >= maxPerDay
    : isHourly ? false
    : todayCount > 0;

  const setsReps = [
    exercise.sets ? `Sets: ${exercise.sets}` : null,
    exercise.reps ? `Reps: ${exercise.reps}` : null,
  ].filter(Boolean).join('  ·  ');

  const donePillLabel = (isMultipleDaily || isHourly) && todayCount > 0
    ? `${todayCount}× Done`
    : 'Done';

  return (
    <div className={`exercise-card ${completedToday ? 'is-done' : ''}`}>
      <div className="card-header" onClick={() => setExpanded((v) => !v)}>
        <div className="card-top-row">
          <span className="exercise-num">{exercise.id}</span>
          <h3 className="exercise-title">{exercise.name}</h3>
          {todayCount > 0 && (
            <span className="done-pill">
              <CheckIcon size={11} />
              {donePillLabel}
            </span>
          )}
          <span className={`expand-chevron ${expanded ? 'open' : ''}`}>
            <ChevronDownIcon size={16} />
          </span>
        </div>

        {setsReps && <p className="card-sets-reps">{setsReps}</p>}

        <Tags exercise={exercise} />
      </div>

      {expanded && (
        <div className="card-body">
          <ImageCarousel images={exercise.images} alt={exercise.name} />
          <p className="exercise-description">{exercise.description}</p>
          <div className="last-done-row">
            <span>Last done</span>
            <span className="last-done-value">
              {formatLastDone(lastDoneDate)}
              {(isMultipleDaily || isHourly) && todayCount > 0 && ` · ${todayCount}× today`}
            </span>
          </div>
        </div>
      )}

      <div className="card-actions">
        <button
          className={`btn-complete ${completedToday ? 'completed' : ''}`}
          onClick={() => onMarkDone(exercise.id)}
        >
          {completedToday ? 'Completed' : 'Mark Complete'}
        </button>
        {history.length > 0 && (
          <button className="btn-undo" onClick={() => onUndo(exercise.id)} aria-label="Undo">
            <UndoIcon size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
