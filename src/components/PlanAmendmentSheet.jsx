import { dateKey } from '../utils/tracker.js';
import { formatDateLong } from '../utils/format.js';

// Shown after a retroactive edit that would change what later days were
// "supposed" to include (issue #53). The session change is already applied;
// this only decides whether to also rewrite those days' recorded plans. The
// affected-day diff is always shown so the choice is never abstract.
function affectedLabel(key) {
  return key === dateKey(new Date()) ? 'Today' : formatDateLong(key);
}

export default function PlanAmendmentSheet({ exerciseName, affected, onKeep, onUpdate }) {
  return (
    <div className="modal-overlay" onClick={onKeep}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Also update the days this changed?</h2>
        <p className="modal-sub">
          Correcting {exerciseName}&rsquo;s log changes what a few days were due to
          include:
        </p>

        <ul className="modal-diff">
          {affected.map(({ key, action }) => (
            <li key={key} className="modal-diff-row">
              <span className="modal-diff-day">{affectedLabel(key)}</span>
              <span className={`modal-diff-action is-${action}`}>
                {action === 'added' ? 'added to plan' : 'removed from plan'}
              </span>
            </li>
          ))}
        </ul>

        <div className="modal-actions">
          {/* Keep is the safe default: only the log was corrected, the plan
              each day recorded stays as-is. */}
          <button className="modal-btn modal-btn-secondary" onClick={onKeep}>
            Keep recorded plans
          </button>
          <button className="modal-btn modal-btn-primary" onClick={onUpdate}>
            Update these days
          </button>
        </div>
      </div>
    </div>
  );
}
