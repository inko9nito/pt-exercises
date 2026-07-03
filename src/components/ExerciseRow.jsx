import { memo } from 'react';
import { ChevronRightIcon, CheckBadgeIcon, StarIcon, ClockIcon } from './Icons.jsx';
import { FREQ } from '../data/exercises.js';
import { isOptionalToday, isDueToday, getNextDueEstimate, getTodayCount } from '../utils/tracker.js';
import { assetUrl } from '../utils/asset.js';

function ExerciseRow({ exercise, completions, onOpen, extra = false, overdueDays = 0, optional: forceOptional = false }) {
  const id = String(exercise.id);
  const history = completions[id] || [];
  const todayCount = getTodayCount(exercise, completions);
  const isMultipleDaily = exercise.freqType === FREQ.MULTIPLE_DAILY;
  const isOpenEnded = exercise.freqType === FREQ.HOURLY || exercise.freqType === FREQ.AS_NEEDED;
  const maxPerDay = exercise.maxPerDay || 99;
  // Optional rows live in "To do" tagged as optional. As-needed exercises are
  // optional every day ("Optional"); an every-other-day one done yesterday is
  // optional only for today ("Optional today").
  const optional = forceOptional || isOptionalToday(exercise, completions);
  const optionalLabel = exercise.freqType === FREQ.AS_NEEDED ? 'Optional' : 'Optional today';
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
            <span className="optional-tag">{optionalLabel}</span>
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
        </span>
        {overdueDays > 0 && (
          <span className="row-overdue-badge">
            <ClockIcon size={12} />
            {overdueDays} {overdueDays === 1 ? 'day' : 'days'} overdue
          </span>
        )}
      </span>
      {extra && (
        <span className="row-extra-badge">
          <StarIcon size={11} />
          Extra
        </span>
      )}
      {isMultipleDaily && (
        <span className={`row-status-badge ${todayCount > 0 ? 'complete' : ''}`}>
          {todayCount}/{maxPerDay}
        </span>
      )}
      {isOpenEnded && exercise.dailyTarget && (
        <span className={`row-status-badge ${todayCount > 0 ? 'complete' : ''}`}>
          {todayCount}/{exercise.dailyTarget}
        </span>
      )}
      {isOpenEnded && todayCount > 0 && !exercise.dailyTarget && (
        <span className="row-status-complete">
          <CheckBadgeIcon size={19} />
          <span className="row-status-count">{todayCount}×</span>
        </span>
      )}
      {!isMultipleDaily && !isOpenEnded && !due && todayCount > 0 && (
        <span className="row-status-check">
          <CheckBadgeIcon size={21} />
        </span>
      )}
      <span className="row-chevron">
        <ChevronRightIcon size={18} />
      </span>
    </button>
  );
}

// `completions` (the whole object) changes on every logged/undone session
// regardless of which exercise it was, so comparing it directly would defeat
// memoization for every row whenever any one of them changes. Only this
// row's own exercise's history array actually determines what it renders —
// and a completions update replaces just the edited exercise's array, so
// every unrelated row's history reference (and this comparison) stays
// stable across it.
function areRowPropsEqual(prev, next) {
  return (
    prev.exercise === next.exercise &&
    prev.onOpen === next.onOpen &&
    prev.extra === next.extra &&
    prev.overdueDays === next.overdueDays &&
    prev.optional === next.optional &&
    prev.completions[String(prev.exercise.id)] === next.completions[String(next.exercise.id)]
  );
}

export default memo(ExerciseRow, areRowPropsEqual);
