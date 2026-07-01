import { useState, useCallback, useEffect, useRef } from 'react';
import DailyView from './components/DailyView.jsx';
import AllExercises from './components/AllExercises.jsx';
import ProgressView from './components/ProgressView.jsx';
import ExerciseDetail from './components/ExerciseDetail.jsx';
import { CalendarIcon, ListIcon, TrendingUpIcon, RefreshIcon } from './components/Icons.jsx';
import { loadCompletions, saveCompletions, markDone, undoLast } from './utils/tracker.js';
import { subscribeToCompletions, pushCompletions } from './utils/sync.js';

const TAB_TODAY = 'today';
const TAB_ALL = 'all';
const TAB_PROGRESS = 'progress';
const VALID_TABS = [TAB_TODAY, TAB_ALL, TAB_PROGRESS];
const DETAIL_EXIT_MS = 300;

// The active tab is mirrored into the URL's ?tab= param (via replaceState,
// so it doesn't grow the history stack) purely so a hard reload — like the
// one pull-to-refresh now triggers — lands back on the tab you were on
// instead of always resetting to Today.
function getInitialTab() {
  const fromUrl = new URLSearchParams(window.location.search).get('tab');
  return VALID_TABS.includes(fromUrl) ? fromUrl : TAB_TODAY;
}

// __BUILD_TIME__/__BUILD_COMMIT__ are injected at build time (see
// vite.config.js) so it's obvious on-device whether a stale, cached bundle
// is being viewed instead of the latest deploy.
function BuildInfo({ onRefresh }) {
  const built = new Date(__BUILD_TIME__).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return (
    <div className="build-info">
      <span>
        Build {__BUILD_COMMIT__} · {built}
      </span>
      <button className="refresh-button" onClick={onRefresh} aria-label="Refresh">
        <RefreshIcon size={13} />
      </button>
    </div>
  );
}

export default function App() {
  const [tab, setTabState] = useState(getInitialTab);
  const [completions, setCompletions] = useState(() => loadCompletions());
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [detailClosing, setDetailClosing] = useState(false);
  const closeTimerRef = useRef(null);
  // Firebase's onValue can fire with an empty placeholder snapshot before
  // its *authoritative* payload arrives (most visible right after a hard
  // reload, which wipes the SDK's in-memory cache along with everything
  // else). ".info/connected" flipping true only proves the socket is up —
  // it doesn't prove the completions listener's real payload has landed
  // yet, so it can't be used to grant trust (that race is exactly what let
  // an empty snapshot stomp good localStorage data even after this guard
  // was first added). Only real, non-empty data is allowed to establish
  // trust; once it has, later legitimate empty states are trusted too.
  const trustedRemoteRef = useRef(false);

  // Firebase is the source of truth; localStorage is just a fast local
  // cache so the app shows last-known state instantly before the
  // subscription connects (and still works if briefly offline).
  useEffect(() => {
    const unsubData = subscribeToCompletions((remote) => {
      const remoteIsEmpty = Object.keys(remote).length === 0;
      if (remoteIsEmpty && !trustedRemoteRef.current) return;
      if (!remoteIsEmpty) trustedRemoteRef.current = true;
      setCompletions(remote);
      saveCompletions(remote);
    });
    return () => {
      unsubData();
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

  // Tracks whether we're the ones who called history.back() (via our own
  // back button) versus popstate firing from something external, like
  // iOS Safari's native edge-swipe-back gesture.
  const intentionalBackRef = useRef(false);

  const closeExercise = useCallback(() => {
    intentionalBackRef.current = true;
    window.history.back();
  }, []);

  const setTab = useCallback((next) => {
    setTabState(next);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', next);
    window.history.replaceState(window.history.state, '', url.toString());
  }, []);

  // The footer's refresh button is an escape hatch for "is this actually
  // the latest build" — a plain data resync doesn't help if the stale part
  // is the JS/CSS bundle itself. Every build's JS/CSS gets a unique
  // content-hash filename, so a stale disk cache can never serve old code
  // under a new build's name — the only thing that can go stale is
  // index.html itself, and a normal reload already re-fetches that. This
  // app has never registered a service worker, so there's nothing else to
  // clear; a plain reload is enough.
  const handleRefresh = useCallback(() => {
    window.location.reload();
  }, []);

  useEffect(() => {
    const onPopState = () => {
      if (intentionalBackRef.current) {
        // We triggered this ourselves via the in-app back button — play
        // our own exit animation.
        intentionalBackRef.current = false;
        setDetailClosing(true);
        closeTimerRef.current = setTimeout(() => {
          setSelectedExercise(null);
          setDetailClosing(false);
        }, DETAIL_EXIT_MS);
      } else {
        // Triggered externally — most commonly iOS Safari's native
        // edge-swipe-back gesture, which already plays its own page
        // transition as you drag. Layering our translateX(100%) exit
        // animation on top double-animated it: our keyframe always
        // starts from translateX(0) regardless of where the native
        // gesture had already visually dragged the screen to, so it
        // snapped back into view and re-slid out — the reported flash.
        // Trust the native transition here and just unmount immediately.
        setSelectedExercise(null);
        setDetailClosing(false);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  return (
    <div className="app">
      <main className="app-main">
        {tab === TAB_TODAY && (
          <DailyView completions={completions} onOpenExercise={openExercise} />
        )}
        {tab === TAB_ALL && (
          <AllExercises completions={completions} onOpenExercise={openExercise} />
        )}
        {tab === TAB_PROGRESS && <ProgressView completions={completions} />}
        <BuildInfo onRefresh={handleRefresh} />
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
