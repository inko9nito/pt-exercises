import { useState, useMemo } from 'react';
import ExerciseRow from './ExerciseRow.jsx';
import { ChevronLeftIcon, SearchIcon } from './Icons.jsx';

export default function AddExerciseSheet({ exercises, completions, onOpenExercise, onClose }) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return exercises;
    return exercises.filter(
      (ex) => ex.name.toLowerCase().includes(q) || ex.description.toLowerCase().includes(q)
    );
  }, [exercises, search]);

  return (
    <div className="detail-screen">
      <div className="detail-header">
        <button className="back-button" onClick={onClose} aria-label="Close">
          <ChevronLeftIcon size={22} />
        </button>
        <span className="detail-header-title">Log another exercise</span>
        <span className="detail-header-spacer" />
      </div>

      <div className="detail-scroll">
        <div className="add-exercise-body">
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
              autoFocus
            />
          </div>

          {filtered.length === 0 ? (
            <p className="empty-state">No exercises match your search.</p>
          ) : (
            <div className="row-group">
              {filtered.map((ex) => (
                <ExerciseRow key={ex.id} exercise={ex} completions={completions} onOpen={onOpenExercise} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
