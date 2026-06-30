import { useState, useCallback, useEffect, useRef } from 'react';
import DailyView from './components/DailyView.jsx';
import AllExercises from './components/AllExercises.jsx';
import ProgressView from './components/ProgressView.jsx';
import ExerciseDetail from './components/ExerciseDetail.jsx';
import { CalendarIcon, ListIcon, TrendingUpIcon, ActivityIcon } from './components/Icons.jsx';
import { loadCompletions, saveCompletions, markDone, undoLast } from './utils/tracker.js';

const TAB_TODAY = 'today';
const TAB_ALL = 'all';
const TAB_PROGRESS = 'progress';
const DETAIL_EXIT_MS = 300;

export default function App() {
  const [tab, setTab] = useState(TAB_TODAY);
  const [completions, setCompletions] = useState(() => loadCompletions());
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [detailClosing, setDetailClosing] = useState(false);
  const closeTimerRef = useRef(null);

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

  const openExercise = useCallback((exercise) => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    window.history.pushState({ exerciseId: exercise.id }, '');
    setDetailClosing(false);
    setSelectedExercise(exercise);
  }, []);

  // Used by the "Up next" card: swaps to the next exercise without growing
  // the history stack, so the back button/swipe still returns to the list
  // (rather than stepping back through every exercise visited via "next").
  const goToNextExercise = useCallback((exercise) => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    window.history.replaceState({ exerciseId: exercise.id }, '');
    setDetailClosing(false);
    setSelectedExercise(exercise);
  }, []);

  const closeExercise = useCallback(() => {
    window.history.back();
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setDetailClosing(true);
      closeTimerRef.current = setTimeout(() => {
        setSelectedExercise(null);
        setDetailClosing(false);
      }, DETAIL_EXIT_MS);
    };
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <div className="header-wordmark">
            <span className="header-name">Domino</span>
            <span className="header-subtitle">Physical therapy</span>
          </div>
          <div className="header-logo">
            <ActivityIcon size={22} />
          </div>
        </div>
      </header>

      <main className="app-main">
        {tab === TAB_TODAY && (
          <DailyView completions={completions} onOpenExercise={openExercise} />
        )}
        {tab === TAB_ALL && (
          <AllExercises completions={completions} onOpenExercise={openExercise} />
        )}
        {tab === TAB_PROGRESS && <ProgressView completions={completions} />}
      </main>

      <nav className="bottom-nav">
        <button
          className={`nav-tab ${tab === TAB_TODAY ? 'active' : ''}`}
          onClick={() => setTab(TAB_TODAY)}
        >
          <span className="nav-icon"><CalendarIcon size={22} /></span>
          <span className="nav-label">Today</span>
        </button>
        <button
          className={`nav-tab ${tab === TAB_ALL ? 'active' : ''}`}
          onClick={() => setTab(TAB_ALL)}
        >
          <span className="nav-icon"><ListIcon size={22} /></span>
          <span className="nav-label">All exercises</span>
        </button>
        <button
          className={`nav-tab ${tab === TAB_PROGRESS ? 'active' : ''}`}
          onClick={() => setTab(TAB_PROGRESS)}
        >
          <span className="nav-icon"><TrendingUpIcon size={22} /></span>
          <span className="nav-label">Progress</span>
        </button>
      </nav>

      {selectedExercise && (
        <ExerciseDetail
          key={selectedExercise.id}
          exercise={selectedExercise}
          completions={completions}
          onMarkDone={handleMarkDone}
          onUndo={handleUndo}
          onClose={closeExercise}
          onNext={goToNextExercise}
          closing={detailClosing}
        />
      )}
    </div>
  );
}
