import { useState, useMemo } from 'react';
import ExerciseCard from './ExerciseCard.jsx';
import { SearchIcon, HomeIcon, TreeIcon, WrenchIcon } from './Icons.jsx';
import { exercises, LOCATION } from '../data/exercises.js';

const FILTERS = [
  { key: 'all',          label: 'All' },
  { key: 'indoor',       label: 'Indoors',    icon: <HomeIcon size={12} /> },
  { key: 'outdoor',      label: 'Outdoors',   icon: <TreeIcon size={12} /> },
  { key: 'equipment',    label: 'Needs Gear', icon: <WrenchIcon size={12} /> },
  { key: 'no-equipment', label: 'No Gear' },
];

export default function AllExercises({ completions, onMarkDone, onUndo }) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    return exercises.filter((ex) => {
      const q = search.toLowerCase();
      const matchSearch =
        !search ||
        ex.name.toLowerCase().includes(q) ||
        ex.description.toLowerCase().includes(q);

      const matchFilter =
        filter === 'all' ||
        (filter === 'indoor'       && ex.location === LOCATION.INDOOR) ||
        (filter === 'outdoor'      && ex.location === LOCATION.OUTDOOR) ||
        (filter === 'equipment'    && ex.equipment.length > 0) ||
        (filter === 'no-equipment' && ex.equipment.length === 0);

      return matchSearch && matchFilter;
    });
  }, [filter, search]);

  return (
    <div className="all-exercises">
      <div className="filter-bar">
        <div className="search-wrap">
          <span className="search-icon"><SearchIcon size={16} /></span>
          <input
            type="search"
            className="search-input"
            placeholder="Search exercises"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-row">
          {FILTERS.map(({ key, label, icon }) => (
            <button
              key={key}
              className={`filter-chip ${filter === key ? 'active' : ''}`}
              onClick={() => setFilter(key)}
            >
              {icon && <span className="tag-icon">{icon}</span>}
              {label}
            </button>
          ))}
        </div>
      </div>

      <p className="results-meta">
        {filtered.length} {filtered.length === 1 ? 'exercise' : 'exercises'}
      </p>

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
