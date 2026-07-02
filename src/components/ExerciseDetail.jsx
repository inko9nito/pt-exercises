import { useEffect } from 'react';
import ImageCarousel from './ImageCarousel.jsx';
import { ChevronLeftIcon, ChevronRightIcon, ClockIcon, WrenchIcon, UndoIcon, CheckIcon, CheckBadgeIcon, TrashIcon } from './Icons.jsx';
import { LOCATION_LABEL, FREQ, exercises } from '../data/exercises.js';
import { isToday, isOptionalToday, isDueToday, getNextDueEstimate, formatLastDone, countSessionsOn } from '../utils/tracker.js';
import { assetUrl } from '../utils/asset.js';

function pluralize(value, singular, plural) {
  return value === '1' ? singular : plural;
}

export default function ExerciseDetail({ exercise, completions, onMarkDone, onUndo, onRemoveFromLog, onClose, onNext, logDate, closing }) {
  const id = String(exercise.id);
  const history = completions[id] || [];
  const todayCount = history.filter(isToday).length;
  const lastDoneDate = history.length > 0 ? new Date(history[history.length - 1]) : null;

  // Opened from a day's log (Progress calendar or a past day): the only
  // action is removing that day's session, not the today-oriented mark/undo.
  const isLogMode = !!logDate;
  const logDayCount = isLogMode ? countSessionsOn(completions, exercise.id, logDate) : 0;

  // Once the last session for this exercise on that day is removed there's
  // nothing left to show in the log, so close back to it.
  useEffect(() => {
    if (isLogMode && logDayCount === 0) onClose();
  }, [isLogMode, logDayCount, onClose]);

  const isMultipleDaily = exercise.freqType === FREQ.MULTIPLE_DAILY;
  const isHourly = exercise.freqType === FREQ.HOURLY;
  const isAsNeeded = exercise.freqType === FREQ.AS_NEEDED;
  const maxPerDay = exercise.maxPerDay || 99;

  // !isDueToday alone isn't enough here — an every-3-days exercise done
  // yesterday is also "not due today", but it hasn't been done *today*, so
  // treating it as completed would hide the Mark complete button entirely
  // (exactly the case opened via "Log another exercise" for something not
  // otherwise scheduled today). Requiring at least one completion today
  // keeps the existing behavior for "as needed" (always due, so this is
  // always false) while still letting an unscheduled exercise be logged
  // instead of showing a false "Completed" state. An hourly exercise with a
  // daily target isn't "done" mid-cooldown either — it's only complete once
  // the target is met, so it can keep logging the next session early.
  const completedToday = isMultipleDaily
    ? todayCount >= maxPerDay
    : isHourly && exercise.dailyTarget
      ? todayCount >= exercise.dailyTarget
      : todayCount > 0 && !isDueToday(exercise, completions);

  const nextExercise = exercises.find((e) => e.id === exercise.id + 1) || null;
  const showUpNext = completedToday && nextExercise;
  const optional = isOptionalToday(exercise, completions);
  const nextDue = getNextDueEstimate(exercise, completions);

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

          {optional && <span className="optional-badge">Optional today — already done yesterday</span>}

          {(exercise.sets || exercise.reps || exercise.duration) && (
            <div className="detail-stats-row">
              {exercise.sets && (
                <span className="detail-stat-inline">
                  <strong>{exercise.sets}</strong> {pluralize(exercise.sets, 'Set', 'Sets')}
                </span>
              )}
              {exercise.reps && (
                <span className="detail-stat-inline">
                  <strong>{exercise.reps}</strong> {pluralize(exercise.reps, 'Rep', 'Reps')}
                </span>
              )}
              {exercise.duration && (
                // Some exercises are a timed hold/massage rather than discrete
                // sets/reps — the duration string already carries its own
                // unit ("10–20 min"), so it doesn't need a Set/Rep-style label.
                <span className="detail-stat-inline">
                  <strong>{exercise.duration}</strong>
                </span>
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
            <p className="detail-description">{exercise.description}</p>
          </div>

          <p className="detail-last-done">
            Last done <strong>{formatLastDone(lastDoneDate)}</strong>
            {(isMultipleDaily || isHourly || isAsNeeded) && todayCount > 0 && ` · ${todayCount}× today`}
          </p>

          {nextDue && (
            <p className="detail-next-due">
              Next due around{' '}
              <strong>{nextDue.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
            </p>
          )}
        </div>
      </div>

      <div className="detail-action-bar">
        {isLogMode ? (
          <div className="log-mode-wrap">
            <div className="completed-status">
              <CheckBadgeIcon size={17} />
              {logDayCount > 1 ? `Done ${logDayCount}× on` : 'Done'}{' '}
              {logDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
            <button className="btn-remove" onClick={() => onRemoveFromLog(exercise.id, logDate)}>
              <TrashIcon size={17} />
              {logDayCount > 1 ? 'Remove a session' : 'Remove from log'}
            </button>
          </div>
        ) : showUpNext ? (
          <div className="up-next-wrap">
            <div className="completed-status">
              <CheckBadgeIcon size={17} />
              Completed
            </div>
            <div className="up-next-row">
              <button className="up-next-card" onClick={() => onNext(nextExercise)}>
                <span className="up-next-thumb">
                  <img src={assetUrl(nextExercise.images[0])} alt="" />
                </span>
                <span className="up-next-body">
                  <span className="up-next-label">Up next</span>
                  <span className="up-next-name">{nextExercise.name}</span>
                </span>
                <span className="row-chevron">
                  <ChevronRightIcon size={18} />
                </span>
              </button>
              {history.length > 0 && (
                <button className="btn-undo" onClick={() => onUndo(exercise.id)} aria-label="Undo">
                  <UndoIcon size={18} />
                </button>
              )}
            </div>
          </div>
        ) : isMultipleDaily ? (
          <div className="session-boxes-wrap">
            <div className="session-boxes-header">
              <span className="session-boxes-label">Today's sessions</span>
              <span className="session-boxes-count">{todayCount} of {maxPerDay} done</span>
            </div>
            <div className="session-boxes">
              {Array.from({ length: maxPerDay }).map((_, i) => {
                const done = i < todayCount;
                const isNext = i === todayCount;
                const isLastDone = i === todayCount - 1;
                const tappable = isNext || isLastDone;
                return (
                  <div className="session-item" key={i}>
                    <button
                      className={`session-box ${done ? 'done' : ''} ${isNext ? 'next' : ''}`}
                      disabled={!tappable}
                      aria-label={done ? `Session ${i + 1} done, tap to undo` : `Mark session ${i + 1} complete`}
                      onClick={() => {
                        if (isNext) onMarkDone(exercise.id);
                        else if (isLastDone) onUndo(exercise.id);
                      }}
                    >
                      {(done || isNext) && <CheckIcon size={18} />}
                    </button>
                    <span className="session-item-label">Session {i + 1}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <>
            <button
              className={`btn-complete ${completedToday ? 'completed' : ''}`}
              onClick={() => onMarkDone(exercise.id)}
            >
              <CheckIcon size={18} />
              {completedToday ? 'Completed' : 'Mark complete'}
            </button>
            {history.length > 0 && (
              <button className="btn-undo" onClick={() => onUndo(exercise.id)} aria-label="Undo">
                <UndoIcon size={18} />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
