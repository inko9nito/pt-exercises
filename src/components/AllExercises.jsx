import { useState, useMemo } from 'react';
import ExerciseCard from './ExerciseCard.jsx';
import { exercises, LOCATION } from '../data/exercises.js';

const FILTER_ALL = 'all';
const FILTER_INDOOR = 'indoor';
const FILTER_OUTDOOR = 'outdoor';
const FILTER_EQUIPMENT = 'equipment';
const FILTER_NO_EQUIPMENT = 'no-equipment';

export default function AllExercises({ completions, onMarkDone, onUndo }) {
  const [filter, setFilter] = useState(FILTER_ALL);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    return exercises.filter((ex) => {
      const matchSearch =
        !search ||
        ex.name.toLowerCase().includes(search.toLowerCase()) ||
        ex.description.toLowerCase().includes(search.toLowerCase());

      const matchFilter =
        filter === FILTER_ALL ||
        (filter === FILTER_INDOOR && ex.location === LOCATION.INDOOR) ||
        (filter === FILTER_OUTDOOR && ex.location === LOCATION.OUTDOOR) ||
        (filter === FILTER_EQUIPMENT && ex.equipment.length > 0) ||
        (filter === FILTER_NO_EQUIPMENT && ex.equipment.length === 0);

      return matchSearch && matchFilter;
    });
  }, [filter, search]);

  return (
    <div className="all-exercises">
      <div className="filter-bar">
        <input
          type="search"
          className="search-input"
          placeholder="Search exercises…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="filter-chips">
          {[
            { key: FILTER_ALL, label: 'All' },
            { key: FILTER_INDOOR, label: '🏠 Indoors' },
            { key: FILTER_OUTDOOR, label: '🌳 Outdoors' },
            { key: FILTER_EQUIPMENT, label: '🛠 Needs gear' },
            { key: FILTER_NO_EQUIPMENT, label: 'No gear' },
          ].map(({ key, label }) => (
            <button
              key={key}
              className={`chip ${filter === key ? 'active' : ''}`}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <p className="results-count">{filtered.length} exercise{filtered.length !== 1 ? 's' : ''}</p>

      <div className="exercise-list">
        {filtered.map((ex) => (
          <ExerciseCard
            key={ex.id}
            exercise={ex}
            completions={completions}
            onMarkDone={onMarkDone}
            onUndo={onUndo}
          />
        ))}
      </div>
    </div>
  );
}
