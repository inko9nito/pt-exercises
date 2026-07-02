import { ChevronRightIcon, CheckCircleIcon, StarIcon } from './Icons.jsx';
import { LOCATION_LABEL, FREQ } from '../data/exercises.js';
import { isToday, isOptionalToday, isDueToday, getNextDueEstimate } from '../utils/tracker.js';
import { assetUrl } from '../utils/asset.js';

export default function ExerciseRow({ exercise, completions, onOpen, extra = false }) {
  const id = String(exercise.id);
  const history = completions[id] || [];
  const todayCount = history.filter(isToday).length;
  const isMultipleDaily = exercise.freqType === FREQ.MULTIPLE_DAILY;
  const isOpenEnded = exercise.freqType === FREQ.HOURLY || exercise.freqType === FREQ.AS_NEEDED;
  const maxPerDay = exercise.maxPerDay || 99;
  const optional = isOptionalToday(exercise, completions);
  const due = isDueToday(exercise, completions);
  const nextDue = getNextDueEstimate(exercise, completions);
  const lastDoneAt =
    todayCount > 0
      ? new Date(history[history.length - 1]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : null;

  return (
    <button className="exercise-row" onClick={() => onOpen(exercise)}>
      <span className="row-thumb">
        <img src={assetUrl(exercise.images[0])} alt="" loading="lazy" />
      </span>
      <span className="row-body">
        <span className="row-name">{exercise.name}</span>
        <span className="row-meta">
          {optional ? (
            <span className="optional-tag">Optional today</span>
          ) : due && lastDoneAt ? (
            <span className="optional-tag">Last done {lastDoneAt}</span>
          ) : nextDue ? (
            <span className="optional-tag">
              Next due ~{nextDue.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          ) : exercise.dailyTarget && todayCount >= exercise.dailyTarget ? (
            <span className="optional-tag">Done for today</span>
          ) : (
            exercise.freqLabel
          )}
          {' · '}
          {LOCATION_LABEL[exercise.location]}
        </span>
      </span>
      {extra && (
        <span className="row-extra-badge">
          <StarIcon size={11} />
          Extra
        </span>
      )}
      {isMultipleDaily && (
        <span className={`row-status-badge ${todayCount >= maxPerDay ? 'complete' : ''}`}>
          {todayCount}/{maxPerDay}
        </span>
      )}
      {isOpenEnded && todayCount > 0 && exercise.dailyTarget && (
        <span className={`row-status-badge ${todayCount >= exercise.dailyTarget ? 'complete' : ''}`}>
          {todayCount}/{exercise.dailyTarget}
        </span>
      )}
      {isOpenEnded && todayCount > 0 && !exercise.dailyTarget && (
        <span className="row-status-complete">
          <CheckCircleIcon size={18} />
          <span className="row-status-count">{todayCount}×</span>
        </span>
      )}
      {!isMultipleDaily && !isOpenEnded && !due && todayCount > 0 && (
        <span className="row-status-check">
          <CheckCircleIcon size={20} />
        </span>
      )}
      <span className="row-chevron">
        <ChevronRightIcon size={18} />
      </span>
    </button>
  );
}
