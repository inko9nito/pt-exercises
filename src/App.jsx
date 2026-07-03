import { useState, useCallback, useEffect, useRef } from 'react';
import DailyView from './components/DailyView.jsx';
import AllExercises from './components/AllExercises.jsx';
import ProgressView from './components/ProgressView.jsx';
import ExerciseDetail from './components/ExerciseDetail.jsx';
import { CalendarIcon, ListIcon, TrendingUpIcon, RefreshIcon } from './components/Icons.jsx';
import {
  loadCompletions,
  saveCompletions,
  markDone,
  markDoneOn,
  removeSessionOn,
  shouldTrustRemoteSnapshot,
} from './utils/tracker.js';
import { subscribeToCompletions, pushExerciseCompletions } from './utils/sync.js';
import { useTodayModel } from './utils/useTodayModel.js';

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
  // Computed once here (rather than separately inside DailyView/ProgressView)
  // so it survives tab switches — App never unmounts, so this only
  // recomputes when `completions` actually changes, not on every navigation
  // back to a tab.
  const todayModel = useTodayModel(completions);
  const [selectedExercise, setSelectedExercise] = useState(null);
  // When an exercise is opened from a day's *log* (a past day in the week
  // strip, or the Progress calendar), this holds that date and the detail
  // switches to a read-only log entry whose only action is removing that
  // day's session — rather than the today-oriented "Mark complete" flow.
  const [logDate, setLogDate] = useState(null);
  const [detailClosing, setDetailClosing] = useState(false);
  const closeTimerRef = useRef(null);
  // See shouldTrustRemoteSnapshot's comment (tracker.js) for why an empty
  // snapshot can't always be trusted at face value.
  const trustedRemoteRef = useRef(false);

  // Firebase is the source of truth; localStorage is just a fast local
  // cache so the app shows last-known state instantly before the
  // subscription connects (and still works if briefly offline).
  useEffect(() => {
    const unsubData = subscribeToCompletions((remote) => {
      if (!shouldTrustRemoteSnapshot(remote, trustedRemoteRef.current)) return;
      trustedRemoteRef.current = true;
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
      pushExerciseCompletions(exerciseId, next[String(exerciseId)]);
      return next;
    });
  }, []);

  // Retroactive logging from a past day's detail view (issue #21).
  const handleLogForDate = useCallback((exerciseId, date) => {
    setCompletions((prev) => {
      const next = markDoneOn(prev, exerciseId, date);
      saveCompletions(next);
      pushExerciseCompletions(exerciseId, next[String(exerciseId)]);
      return next;
    });
  }, []);

  // Undo only ever removes *today's* most recent session (never a past
  // day's) — see issue #43: the exercise-detail undo button used to remove
  // the globally-latest session via undoLast, which silently deleted a prior
  // day's logged session for anything not yet done today.
  const handleUndo = useCallback((exerciseId) => {
    setCompletions((prev) => {
      const next = removeSessionOn(prev, exerciseId, new Date());
      if (next === prev) return prev; // nothing to undo
      saveCompletions(next);
      pushExerciseCompletions(exerciseId, next[String(exerciseId)]);
      return next;
    });
  }, []);

  const handleRemoveFromLog = useCallback((exerciseId, date) => {
    setCompletions((prev) => {
      const next = removeSessionOn(prev, exerciseId, date);
      if (next === prev) return prev; // nothing on that day to remove
      saveCompletions(next);
      pushExerciseCompletions(exerciseId, next[String(exerciseId)]);
      return next;
    });
  }, []);

  // `date` (optional) opens the exercise as a log entry for that day; omitted
  // for the normal today/library flow.
  const openExercise = useCallback((exercise, date = null) => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    window.history.pushState({ exerciseId: exercise.id }, '');
    setDetailClosing(false);
    setLogDate(date);
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
  // the latest build". Every build's JS/CSS gets a unique content-hash
  // filename, so the only thing that can go stale is index.html itself —
  // and it's the one file that *can't* be hash-busted. GitHub Pages serves
  // it with Cache-Control: max-age=600, so a plain location.reload() keeps
  // handing back the cached HTML (still pointing at the old bundle) for up
  // to ten minutes, and iOS home-screen web apps hold onto it far longer.
  // Navigating to a URL with a fresh cache-busting query param sidesteps
  // that: the browser can't serve the previous document from cache under a
  // URL it hasn't seen, so it re-fetches index.html and picks up the newest
  // bundle. The current tab is carried along so we land back where we were.
  const handleRefresh = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('_', Date.now().toString());
    window.location.replace(url.toString());
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

  // Drop the cache-busting '_' param the refresh button leaves behind so it
  // doesn't linger in the URL or get bookmarked; a fresh value is minted on
  // each refresh anyway, so nothing depends on the old one persisting.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has('_')) {
      url.searchParams.delete('_');
      window.history.replaceState(window.history.state, '', url.toString());
    }
  }, []);

  return (
    <div className="app">
      <main className="app-main">
        {tab === TAB_TODAY && (
          <DailyView
            completions={completions}
            todayModel={todayModel}
            onOpenExercise={openExercise}
            onLogForDate={handleLogForDate}
          />
        )}
        {tab === TAB_ALL && (
          <AllExercises completions={completions} onOpenExercise={openExercise} />
        )}
        {tab === TAB_PROGRESS && (
          <ProgressView completions={completions} todayModel={todayModel} onOpenExercise={openExercise} />
        )}
        <BuildInfo onRefresh={handleRefresh} />
      </main>

      <nav className="bottom-nav">
        <button
          className={`nav-tab ${tab === TAB_TODAY ? 'active' : ''}`}
          onClick={() => setTab(TAB_TODAY)}
        >
          <span className="nav-tab-box">
            <span className="nav-icon"><CalendarIcon size={22} /></span>
            <span className="nav-label">Today</span>
          </span>
        </button>
        <button
          className={`nav-tab ${tab === TAB_ALL ? 'active' : ''}`}
          onClick={() => setTab(TAB_ALL)}
        >
          <span className="nav-tab-box">
            <span className="nav-icon"><ListIcon size={22} /></span>
            <span className="nav-label">All exercises</span>
          </span>
        </button>
        <button
          className={`nav-tab ${tab === TAB_PROGRESS ? 'active' : ''}`}
          onClick={() => setTab(TAB_PROGRESS)}
        >
          <span className="nav-tab-box">
            <span className="nav-icon"><TrendingUpIcon size={22} /></span>
            <span className="nav-label">Progress</span>
          </span>
        </button>
      </nav>

      {selectedExercise && (
        <ExerciseDetail
          key={selectedExercise.id}
          exercise={selectedExercise}
          completions={completions}
          onMarkDone={handleMarkDone}
          onUndo={handleUndo}
          onRemoveFromLog={handleRemoveFromLog}
          onClose={closeExercise}
          onNext={goToNextExercise}
          logDate={logDate}
          closing={detailClosing}
        />
      )}
    </div>
  );
}
