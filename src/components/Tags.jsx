import { LOCATION } from '../data/exercises.js';

const locationConfig = {
  [LOCATION.INDOOR]: { label: 'Indoors', icon: '🏠', className: 'tag-indoor' },
  [LOCATION.OUTDOOR]: { label: 'Outdoors', icon: '🌳', className: 'tag-outdoor' },
  [LOCATION.EITHER]: { label: 'In/Outdoors', icon: '↕', className: 'tag-either' },
};

export default function Tags({ exercise }) {
  const loc = locationConfig[exercise.location];

  return (
    <div className="tags">
      <span className={`tag tag-freq`}>{exercise.freqLabel}</span>
      <span className={`tag ${loc.className}`}>
        {loc.icon} {loc.label}
      </span>
      {exercise.equipment.length > 0 &&
        exercise.equipment.map((eq) => (
          <span key={eq} className="tag tag-equipment">
            🛠 {eq}
          </span>
        ))}
      {exercise.equipment.length === 0 && (
        <span className="tag tag-no-equipment">No equipment</span>
      )}
    </div>
  );
}
