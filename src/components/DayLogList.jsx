import { memo } from 'react';
import { CheckBadgeIcon, ChevronRightIcon, StarIcon } from './Icons.jsx';
import { exerciseById } from '../data/exercises.js';
import { assetUrl } from '../utils/asset.js';

// Shared "what happened on this day" list, used by both the week strip's
// past-day view (DailyView) and the Progress calendar's day-detail
// (ProgressView) so the two never drift apart. Entries come from
// getDayEntries and include the day's *planned* exercises (done or missed)
// alongside any extra sessions — so a past day reads like the Today view
// rather than only showing what was logged (issue #53). `entries`/`date` are
// only new references when the selected day (or its data) actually changes —
// see the useMemo in each caller — so the default shallow prop comparison is
// enough to skip re-rendering on unrelated parent re-renders.
function DayLogList({ entries, date, onOpenExercise, emptyMessage }) {
  if (entries.length === 0) {
    return <p className="day-detail-empty">{emptyMessage}</p>;
  }

  return (
    <div className="row-group">
      {entries.map((entry) => {
        const ex = exerciseById.get(entry.id);
        if (!ex) return null;
        return (
          <button
            key={entry.id}
            className={`exercise-row ${entry.done ? '' : 'is-missed'}`}
            onClick={() => onOpenExercise?.(ex, date)}
          >
            <span className="row-thumb">
              <img src={assetUrl(ex.images[0])} alt="" loading="lazy" />
            </span>
            <span className="row-body">
              <span className="row-name">{entry.name}</span>
              <span className="row-meta">
                {entry.done
                  ? entry.times.length > 1
                    ? `${entry.times.length}× · ${entry.times.join(', ')}`
                    : `Done ${entry.times[0]}`
                  : entry.freqLabel}
              </span>
            </span>
            {entry.extra && (
              <span className="row-extra-badge">
                <StarIcon size={11} />
                Extra
              </span>
            )}
            {entry.done ? (
              <span className="row-status-check">
                <CheckBadgeIcon size={21} />
              </span>
            ) : (
              <span className="row-status-missed">Missed</span>
            )}
            <span className="row-chevron">
              <ChevronRightIcon size={18} />
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default memo(DayLogList);
