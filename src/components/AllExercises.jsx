import { useState, useMemo } from 'react';
import ExerciseRow from './ExerciseRow.jsx';
import { SearchIcon, WrenchIcon } from './Icons.jsx';
import { exercises } from '../data/exercises.js';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'equipment', label: 'Needs gear', icon: <WrenchIcon size={12} /> },
  { key: 'no-equipment', label: 'No gear' },
];

export default function AllExercises({ completions, onOpenExercise }) {
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
        (filter === 'equipment' && ex.equipment.length > 0) ||
        (filter === 'no-equipment' && ex.equipment.length === 0);

      return matchSearch && matchFilter;
    });
  }, [filter, search]);

  return (
    <div className="all-exercises">
      <div className="filter-bar">
        <div className="search-wrap">
          <span className="search-icon">
            <SearchIcon size={16} />
          </span>
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
              {icon && <span className="filter-chip-icon">{icon}</span>}
              {label}
            </button>
          ))}
        </div>
      </div>

      <p className="results-meta">
        {filtered.length} {filtered.length === 1 ? 'exercise' : 'exercises'}
      </p>

      {filtered.length === 0 ? (
        <p className="empty-state">No exercises match your filters.</p>
      ) : (
        <div className="row-group">
          {filtered.map((ex) => (
            <ExerciseRow
              key={ex.id}
              exercise={ex}
              completions={completions}
              onOpen={onOpenExercise}
            />
          ))}
        </div>
      )}
    </div>
  );
}
