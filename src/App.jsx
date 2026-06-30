import { useState, useCallback } from 'react';
import DailyView from './components/DailyView.jsx';
import AllExercises from './components/AllExercises.jsx';
import { loadCompletions, saveCompletions, markDone, undoLast } from './utils/tracker.js';

const TAB_TODAY = 'today';
const TAB_ALL = 'all';

export default function App() {
  const [tab, setTab] = useState(TAB_TODAY);
  const [completions, setCompletions] = useState(() => loadCompletions());

  const handleMarkDone = useCallback((exerciseId) => {
    setCompletions((prev) => {
      const next = markDone(prev, exerciseId);
      saveCompletions(next);
      return next;
    });
  }, []);

  const handleUndo = useCallback((exerciseId) => {
    setCompletions((prev) => {
      const next = undoLast(prev, exerciseId);
      saveCompletions(next);
      return next;
    });
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <div className="header-paw">🐾</div>
          <div>
            <h1 className="app-title">Domino's PT</h1>
            <p className="app-subtitle">Physical Therapy Exercises</p>
          </div>
        </div>
      </header>

      <main className="app-main">
        {tab === TAB_TODAY && (
          <DailyView
            completions={completions}
            onMarkDone={handleMarkDone}
            onUndo={handleUndo}
          />
        )}
        {tab === TAB_ALL && (
          <AllExercises
            completions={completions}
            onMarkDone={handleMarkDone}
            onUndo={handleUndo}
          />
        )}
      </main>

      <nav className="bottom-nav">
        <button
          className={`nav-tab ${tab === TAB_TODAY ? 'active' : ''}`}
          onClick={() => setTab(TAB_TODAY)}
        >
          <span className="nav-icon">📋</span>
          <span className="nav-label">Today</span>
        </button>
        <button
          className={`nav-tab ${tab === TAB_ALL ? 'active' : ''}`}
          onClick={() => setTab(TAB_ALL)}
        >
          <span className="nav-icon">📚</span>
          <span className="nav-label">All Exercises</span>
        </button>
      </nav>
    </div>
  );
}
