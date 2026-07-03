import { CheckBadgeIcon, ChevronRightIcon, StarIcon } from './Icons.jsx';
import { exerciseById } from '../data/exercises.js';
import { assetUrl } from '../utils/asset.js';
import { isScheduledOn } from '../utils/tracker.js';

// Shared "what happened on this day" card list, used by both the week
// strip's past-day view (DailyView) and the Progress calendar's day-detail
// (ProgressView) so the two never drift apart.
export default function DayLogList({ cards, date, completions, onOpenExercise, emptyMessage }) {
  if (cards.length === 0) {
    return <p className="day-detail-empty">{emptyMessage}</p>;
  }

  return (
    <div className="row-group">
      {cards.map((card) => {
        const ex = exerciseById.get(card.id);
        if (!ex) return null;
        // "Extra" = wasn't on that specific day's plan (optional or logged as
        // an unscheduled add) — same rule as today's Completed section, but
        // evaluated for the day this card belongs to.
        const extra = !isScheduledOn(ex, completions, date);
        return (
          <button key={card.id} className="exercise-row" onClick={() => onOpenExercise?.(ex, date)}>
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
  );
}
