import { LOCATION } from '../data/exercises.js';
import { HomeIcon, TreeIcon, WrenchIcon, ClockIcon } from './Icons.jsx';

export default function Tags({ exercise }) {
  const locationTag = {
    [LOCATION.INDOOR]:  { label: 'Indoors',    icon: <HomeIcon />,  className: 'tag-indoor' },
    [LOCATION.OUTDOOR]: { label: 'Outdoors',   icon: <TreeIcon />,  className: 'tag-outdoor' },
    [LOCATION.EITHER]:  { label: 'In / Out',   icon: <HomeIcon />,  className: 'tag-either' },
  }[exercise.location];

  return (
    <div className="tags">
      <span className="tag tag-freq">
        <span className="tag-icon"><ClockIcon /></span>
        {exercise.freqLabel}
      </span>

      <span className={`tag ${locationTag.className}`}>
        <span className="tag-icon">{locationTag.icon}</span>
        {locationTag.label}
      </span>

      {exercise.equipment.length > 0
        ? exercise.equipment.map((eq) => (
            <span key={eq} className="tag tag-equipment">
              <span className="tag-icon"><WrenchIcon /></span>
              {eq}
            </span>
          ))
        : (
            <span className="tag tag-no-equipment">No Equipment</span>
          )
      }
    </div>
  );
}
