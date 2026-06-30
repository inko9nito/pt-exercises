import { ChevronRightIcon, CheckCircleIcon } from './Icons.jsx';
import { LOCATION_LABEL, FREQ } from '../data/exercises.js';
import { isToday, isOptionalToday, isDueToday, getNextDueEstimate } from '../utils/tracker.js';
import { assetUrl } from '../utils/asset.js';

export default function ExerciseRow({ exercise, completions, onOpen }) {
  const id = String(exercise.id);
  const history = completions[id] || [];
  const todayCount = history.filter(isToday).length;
  const isMultipleDaily = exercise.freqType === FREQ.MULTIPLE_DAILY;
  const isOpenEnded = exercise.freqType === FREQ.HOURLY || exercise.freqType === FREQ.AS_NEEDED;
  const maxPerDay = exercise.maxPerDay || 99;
  const optional = isOptionalToday(exercise, completions);
  const due = isDueToday(exercise, completions);
  const nextDue = getNextDueEstimate(exercise, completions);

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
          ) : nextDue ? (
            <span className="optional-tag">
              Next due ~{nextDue.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          ) : (
            exercise.freqLabel
          )}
          {' · '}
          {LOCATION_LABEL[exercise.location]}
        </span>
      </span>
      {isMultipleDaily && todayCount > 0 && (
        <span className={`row-status-badge ${todayCount >= maxPerDay ? 'complete' : ''}`}>
          {todayCount}/{maxPerDay}
        </span>
      )}
      {isOpenEnded && todayCount > 0 && (
        <span className="row-status-badge">{todayCount}×</span>
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
