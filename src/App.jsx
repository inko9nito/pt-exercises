import { useState, useCallback, useEffect, useRef } from 'react';
import DailyView from './components/DailyView.jsx';
import AllExercises from './components/AllExercises.jsx';
import ProgressView from './components/ProgressView.jsx';
import ExerciseDetail from './components/ExerciseDetail.jsx';
import PullToRefresh from './components/PullToRefresh.jsx';
import { CalendarIcon, ListIcon, TrendingUpIcon, ActivityIcon } from './components/Icons.jsx';
import { loadCompletions, saveCompletions, markDone, undoLast } from './utils/tracker.js';
import {
  subscribeToCompletions,
  subscribeToConnectionStatus,
  pushCompletions,
  fetchCompletionsOnce,
} from './utils/sync.js';

const TAB_TODAY = 'today';
const TAB_ALL = 'all';
const TAB_PROGRESS = 'progress';
const DETAIL_EXIT_MS = 300;

// __BUILD_TIME__/__BUILD_COMMIT__ are injected at build time (see
// vite.config.js) so it's obvious on-device whether a stale, cached bundle
// is being viewed instead of the latest deploy.
function BuildInfo() {
  const built = new Date(__BUILD_TIME__).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return (
    <div className="build-info">
      Build {__BUILD_COMMIT__} · {built}
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState(TAB_TODAY);
  const [completions, setCompletions] = useState(() => loadCompletions());
  const [synced, setSynced] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [detailClosing, setDetailClosing] = useState(false);
  const closeTimerRef = useRef(null);

  // Firebase is the source of truth; localStorage is just a fast local
  // cache so the app shows last-known state instantly before the
  // subscription connects (and still works if briefly offline).
  useEffect(() => {
    const unsubData = subscribeToCompletions((remote) => {
      setCompletions(remote);
      saveCompletions(remote);
    });
    const unsubConnection = subscribeToConnectionStatus(setSynced);
    return () => {
      unsubData();
      unsubConnection();
    };
  }, []);

  const handleMarkDone = useCallback((exerciseId) => {
    setCompletions((prev) => {
      const next = markDone(prev, exerciseId);
      saveCompletions(next);
      pushCompletions(next);
      return next;
    });
  }, []);

  const handleUndo = useCallback((exerciseId) => {
    setCompletions((prev) => {
      const next = undoLast(prev, exerciseId);
      saveCompletions(next);
      pushCompletions(next);
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

  // Firebase's one-shot get() can hang rather than reject when the device is
  // offline, which would otherwise leave the pull-to-refresh spinner stuck
  // forever — race it against a timeout so the gesture always settles.
  const handleRefresh = useCallback(async () => {
    const timeout = new Promise((resolve) => setTimeout(resolve, 4000, null));
    const remote = await Promise.race([fetchCompletionsOnce(), timeout]);
    if (remote) {
      setCompletions(remote);
      saveCompletions(remote);
    }
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
            <span className="header-subtitle">
              Physical therapy
              <span className={`sync-status ${synced ? 'is-synced' : ''}`}>
                {synced ? 'Synced' : 'Connecting…'}
              </span>
            </span>
          </div>
          <div className="header-logo">
            <ActivityIcon size={22} />
          </div>
        </div>
      </header>

      <PullToRefresh onRefresh={handleRefresh}>
        {tab === TAB_TODAY && (
          <DailyView completions={completions} onOpenExercise={openExercise} />
        )}
        {tab === TAB_ALL && (
          <AllExercises completions={completions} onOpenExercise={openExercise} />
        )}
        {tab === TAB_PROGRESS && <ProgressView completions={completions} />}
        <BuildInfo />
      </PullToRefresh>

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
