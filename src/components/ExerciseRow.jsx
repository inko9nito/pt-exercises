import { ChevronRightIcon, CheckCircleIcon } from './Icons.jsx';
import { LOCATION_LABEL } from '../data/exercises.js';
import { isToday } from '../utils/tracker.js';
import { assetUrl } from '../utils/asset.js';

export default function ExerciseRow({ exercise, completions, onOpen }) {
  const id = String(exercise.id);
  const history = completions[id] || [];
  const doneToday = history.some(isToday);

  return (
    <button className="exercise-row" onClick={() => onOpen(exercise)}>
      <span className="row-thumb">
        <img src={assetUrl(exercise.images[0])} alt="" loading="lazy" />
        {doneToday && (
          <span className="row-done-badge">
            <CheckCircleIcon size={16} />
          </span>
        )}
      </span>
      <span className="row-body">
        <span className="row-name">{exercise.name}</span>
        <span className="row-meta">
          {exercise.freqLabel} · {LOCATION_LABEL[exercise.location]}
        </span>
      </span>
      <span className="row-chevron">
        <ChevronRightIcon size={18} />
      </span>
    </button>
  );
}
