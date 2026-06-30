import ImageCarousel from './ImageCarousel.jsx';
import { ChevronLeftIcon, ClockIcon, WrenchIcon, UndoIcon } from './Icons.jsx';
import { LOCATION_LABEL, FREQ } from '../data/exercises.js';
import { isToday, formatLastDone } from '../utils/tracker.js';

export default function ExerciseDetail({ exercise, completions, onMarkDone, onUndo, onClose, closing }) {
  const id = String(exercise.id);
  const history = completions[id] || [];
  const todayCount = history.filter(isToday).length;
  const lastDoneDate = history.length > 0 ? new Date(history[history.length - 1]) : null;

  const isMultipleDaily = exercise.freqType === FREQ.MULTIPLE_DAILY;
  const isHourly = exercise.freqType === FREQ.HOURLY;
  const maxPerDay = exercise.maxPerDay || 99;

  const completedToday = isMultipleDaily
    ? todayCount >= maxPerDay
    : isHourly
    ? false
    : todayCount > 0;

  return (
    <div className={`detail-screen ${closing ? 'is-closing' : ''}`}>
      <div className="detail-header">
        <button className="back-button" onClick={onClose} aria-label="Back">
          <ChevronLeftIcon size={22} />
        </button>
        <span className="detail-header-title">Exercise {exercise.id}</span>
        <span className="detail-header-spacer" />
      </div>

      <div className="detail-scroll">
        <ImageCarousel images={exercise.images} alt={exercise.name} />

        <div className="detail-body">
          <h1 className="detail-title">{exercise.name}</h1>

          <div className="detail-meta-row">
            <span className="detail-meta-item">
              <ClockIcon size={14} />
              {exercise.freqLabel}
            </span>
            <span className="detail-meta-dot">·</span>
            <span className="detail-meta-item">{LOCATION_LABEL[exercise.location]}</span>
          </div>

          {(exercise.sets || exercise.reps) && (
            <div className="detail-stats-row">
              {exercise.sets && (
                <div className="detail-stat">
                  <span className="detail-stat-value">{exercise.sets}</span>
                  <span className="detail-stat-label">Sets</span>
                </div>
              )}
              {exercise.reps && (
                <div className="detail-stat">
                  <span className="detail-stat-value">{exercise.reps}</span>
                  <span className="detail-stat-label">Reps</span>
                </div>
              )}
            </div>
          )}

          {exercise.equipment.length > 0 && (
            <div className="detail-section">
              <p className="detail-section-label">Equipment needed</p>
              <div className="chip-row">
                {exercise.equipment.map((eq) => (
                  <span key={eq} className="chip">
                    <WrenchIcon size={13} />
                    {eq}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="detail-section">
            <p className="detail-section-label">How to</p>
            <p className="detail-description">{exercise.description}</p>
          </div>

          <p className="detail-last-done">
            Last done <strong>{formatLastDone(lastDoneDate)}</strong>
            {(isMultipleDaily || isHourly) && todayCount > 0 && ` · ${todayCount}× today`}
          </p>
        </div>
      </div>

      <div className="detail-action-bar">
        <button
          className={`btn-complete ${completedToday ? 'completed' : ''}`}
          onClick={() => onMarkDone(exercise.id)}
        >
          {completedToday ? 'Completed' : 'Mark complete'}
        </button>
        {history.length > 0 && (
          <button className="btn-undo" onClick={() => onUndo(exercise.id)} aria-label="Undo">
            <UndoIcon size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
