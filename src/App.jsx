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
  loadPlans,
  savePlans,
  buildPlanSnapshot,
  missingPlanDays,
  dateFromKey,
  dateKey,
  affectedPlanDays,
  applyPlanAmendments,
} from './utils/tracker.js';
import {
  subscribeToCompletions,
  pushExerciseCompletions,
  replayPendingWrites,
  subscribeToPlans,
  pushDayPlan,
} from './utils/sync.js';
import { useTodayModel } from './utils/useTodayModel.js';
import { useWakeLock } from './utils/useWakeLock.js';
import { exercises, exerciseById } from './data/exercises.js';
import PlanAmendmentSheet from './components/PlanAmendmentSheet.jsx';

const TAB_TODAY = 'today';
const TAB_ALL = 'all';
const TAB_PROGRESS = 'progress';
const VALID_TABS = [TAB_TODAY, TAB_ALL, TAB_PROGRESS];
const DETAIL_EXIT_MS = 300;
const EX_PARAM = 'ex';

// The active tab is mirrored into the URL's ?tab= param (via replaceState,
// so it doesn't grow the history stack) purely so a hard reload — like the
// one pull-to-refresh now triggers — lands back on the tab you were on
// instead of always resetting to Today.
function getInitialTab() {
  const fromUrl = new URLSearchParams(window.location.search).get('tab');
  return VALID_TABS.includes(fromUrl) ? fromUrl : TAB_TODAY;
}

// The open exercise is likewise mirrored into ?ex= so a hard reload restores
// it instead of dumping you back on the list (issue #68 #1). That matters
// most for the keep-awake refresh hack's rare *real* reload — which can fire
// while you're mid-exercise with the detail open — but it also fixes the
// footer refresh button, which until now silently closed the open exercise.
// Restored in the normal (today) mode; a past-day log entry reopens as today,
// an acceptable degradation for a rare reload rather than encoding logDate.
function getInitialExercise() {
  const raw = new URLSearchParams(window.location.search).get(EX_PARAM);
  if (!raw) return null;
  const id = Number(raw);
  return exercises.find((ex) => ex.id === id) || null;
}

// Current URL with ?ex= set (or removed when id is null), preserving ?tab=
// and anything else. Used for the pushed detail entry and the list entry it
// sits on top of.
function exerciseUrl(id) {
  const url = new URL(window.location.href);
  // Never carry the refresh button's transient cache-buster into a pushed
  // entry — same intent as the '_' cleanup effect below.
  url.searchParams.delete('_');
  if (id == null) url.searchParams.delete(EX_PARAM);
  else url.searchParams.set(EX_PARAM, String(id));
  return url.toString();
}

// The verbose keep-awake diagnostic (`wake: video playing · lock failed …`)
// was invaluable during the #54 investigation but is developer noise for
// daily use (issue #68 #3). It's now only shown with ?debug in the URL —
// off by default, one tap away when the next on-device round needs it.
const wakeParams =
  typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search)
    : new URLSearchParams();
const WAKE_DEBUG = wakeParams.has('debug');

// __BUILD_TIME__/__BUILD_COMMIT__ are injected at build time (see
// vite.config.js) so it's obvious on-device whether a stale, cached bundle
// is being viewed instead of the latest deploy.
function BuildInfo({ onRefresh, wakeStatus }) {
  const built = new Date(__BUILD_TIME__).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return (
    <div className="build-info">
      <div className="build-info-row">
        <span>
          Build {__BUILD_COMMIT__} · {built}
        </span>
        <button className="refresh-button" onClick={onRefresh} aria-label="Refresh">
          <RefreshIcon size={13} />
        </button>
      </div>
      {WAKE_DEBUG && <span>wake: {wakeStatus}</span>}
    </div>
  );
}

export default function App() {
  const [tab, setTabState] = useState(getInitialTab);
  const [completions, setCompletions] = useState(() => loadCompletions());
  // Stored per-day plan snapshots (issue #53), mirrored like completions.
  const [plans, setPlans] = useState(() => loadPlans());
  // Computed once here (rather than separately inside DailyView/ProgressView)
  // so it survives tab switches — App never unmounts, so this only
  // recomputes when `completions`/`plans` actually change, not on every
  // navigation back to a tab.
  const todayModel = useTodayModel(completions, plans);
  // Hold the screen awake while the app is open so the phone doesn't lock
  // mid-exercise (issue #54). The returned status is shown next to the
  // build info so on-device behavior is diagnosable without a debugger.
  const { status: wakeStatus } = useWakeLock();
  // Initialized from ?ex= so a hard reload (see getInitialExercise) restores
  // the open exercise rather than resetting to the list.
  const [selectedExercise, setSelectedExercise] = useState(getInitialExercise);
  // When an exercise is opened from a day's *log* (a past day in the week
  // strip, or the Progress calendar), this holds that date and the detail
  // switches to a read-only log entry whose only action is removing that
  // day's session — rather than the today-oriented "Mark complete" flow.
  const [logDate, setLogDate] = useState(null);
  // Whether the open detail was reached from the "Log another" sheet. When it
  // was, the detail must render *above* that sheet (which stays mounted
  // underneath) so backing out of the exercise returns to the sheet rather
  // than closing it entirely (issue #86).
  const [detailFromSheet, setDetailFromSheet] = useState(false);
  const [detailClosing, setDetailClosing] = useState(false);
  const closeTimerRef = useRef(null);
  // See shouldTrustRemoteSnapshot's comment (tracker.js) for why an empty
  // snapshot can't always be trusted at face value.
  const trustedRemoteRef = useRef(false);
  // Readiness gates for the plan backfill: it must wait until we have the
  // authoritative remote completions (real history to reconstruct plans from)
  // *and* the remote plans (so it doesn't rewrite days that already exist).
  const [completionsReady, setCompletionsReady] = useState(false);
  const [plansReady, setPlansReady] = useState(false);
  const backfilledRef = useRef(false);
  // When a retroactive edit changes what later days were due to include, this
  // holds { exerciseId, affected } to drive the plan-amendment prompt (#53).
  const [planPrompt, setPlanPrompt] = useState(null);

  // If ?ex= restored an open exercise on load (e.g. after the keep-awake
  // refresh hack's rare real reload, or the footer refresh button), the
  // history stack is a single entry — nothing for the in-app back button /
  // edge-swipe to return to. Rebuild the [list, detail] pair the normal
  // open flow produces, so closing lands on the list instead of leaving the
  // app. The ref guard keeps StrictMode's dev double-invoke from pushing
  // twice (it's a one-time bootstrap, not a subscription).
  const historyRestoredRef = useRef(false);
  useEffect(() => {
    if (historyRestoredRef.current) return;
    historyRestoredRef.current = true;
    if (!selectedExercise) return;
    window.history.replaceState({}, '', exerciseUrl(null));
    window.history.pushState(
      { exerciseId: selectedExercise.id },
      '',
      exerciseUrl(selectedExercise.id)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Firebase is the source of truth; localStorage is just a fast local
  // cache so the app shows last-known state instantly before the
  // subscription connects (and still works if briefly offline).
  useEffect(() => {
    // Re-push any writes still marked pending from a prior session before the
    // subscription can overwrite the local cache with a remote snapshot that
    // predates them (issue #68 #2). Synchronous, so it reads the local cache
    // ahead of the subscription's first (async) delivery.
    replayPendingWrites();
    const unsubData = subscribeToCompletions((remote) => {
      if (!shouldTrustRemoteSnapshot(remote, trustedRemoteRef.current)) return;
      trustedRemoteRef.current = true;
      setCompletions(remote);
      saveCompletions(remote);
      setCompletionsReady(true);
    });
    // Plans have no "empty placeholder" ambiguity to guard against the way
    // completions do — an empty plans tree is a legitimate first-run state
    // that should trigger the backfill — so every snapshot is trusted.
    const unsubPlans = subscribeToPlans((remote) => {
      setPlans(remote);
      savePlans(remote);
      setPlansReady(true);
    });
    return () => {
      unsubData();
      unsubPlans();
    };
  }, []);

  // One-time plan backfill (issue #53). Once both the authoritative
  // completions and plans have loaded, write a snapshot for every day that
  // doesn't have one yet — the whole history through today. Gated on both
  // being ready so it never reconstructs plans from half-loaded history or
  // clobbers snapshots that already exist remotely; `backfilledRef` keeps it
  // to a single pass. Each write is idempotent, so a missed one is just
  // recomputed next load.
  useEffect(() => {
    if (!completionsReady || !plansReady || backfilledRef.current) return;
    backfilledRef.current = true;
    const days = missingPlanDays(completions, plans);
    if (days.length === 0) return;
    const todayKey = dateKey(new Date());
    const additions = {};
    for (const key of days) {
      const source = key === todayKey ? 'live' : 'backfilled';
      const snap = buildPlanSnapshot(exercises, completions, dateFromKey(key), source);
      additions[key] = snap;
      pushDayPlan(key, snap);
    }
    // Mirror the writes into local state/cache immediately (same immediacy as
    // handleMarkDone) rather than waiting for the subscription to echo them
    // back. Guarded by backfilledRef, so this can't cascade — the resulting
    // `plans` change just re-runs the effect once, which returns early.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlans((prev) => {
      const next = { ...prev, ...additions };
      savePlans(next);
      return next;
    });
  }, [completionsReady, plansReady, completions, plans]);

  const handleMarkDone = useCallback((exerciseId) => {
    setCompletions((prev) => {
      const next = markDone(prev, exerciseId);
      saveCompletions(next);
      pushExerciseCompletions(exerciseId, next[String(exerciseId)]);
      return next;
    });
  }, []);

  // A retroactive edit can change what *later* days were due to include, so
  // after applying the session change it checks for affected days and, if
  // any, prompts whether to also rewrite those days' recorded plans (#53).
  const maybePromptPlanAmendment = useCallback(
    (exerciseId, date, prevCompletions, nextCompletions) => {
      const exercise = exerciseById.get(exerciseId);
      if (!exercise) return;
      const affected = affectedPlanDays(exercise, prevCompletions, nextCompletions, plans, date);
      if (affected.length > 0) setPlanPrompt({ exerciseId, affected });
    },
    [plans]
  );

  // Retroactive logging from a past day's detail view (issue #21).
  const handleLogForDate = useCallback(
    (exerciseId, date) => {
      const next = markDoneOn(completions, exerciseId, date);
      setCompletions(next);
      saveCompletions(next);
      pushExerciseCompletions(exerciseId, next[String(exerciseId)]);
      maybePromptPlanAmendment(exerciseId, date, completions, next);
    },
    [completions, maybePromptPlanAmendment]
  );

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

  const handleRemoveFromLog = useCallback(
    (exerciseId, date) => {
      const next = removeSessionOn(completions, exerciseId, date);
      if (next === completions) return; // nothing on that day to remove
      setCompletions(next);
      saveCompletions(next);
      pushExerciseCompletions(exerciseId, next[String(exerciseId)]);
      maybePromptPlanAmendment(exerciseId, date, completions, next);
    },
    [completions, maybePromptPlanAmendment]
  );

  const dismissPlanPrompt = useCallback(() => setPlanPrompt(null), []);

  // "Update these days": rewrite just this exercise's membership in each
  // affected day's snapshot and persist the touched days (scoped writes).
  const applyPlanUpdate = useCallback(() => {
    if (!planPrompt) return;
    const exercise = exerciseById.get(planPrompt.exerciseId);
    const next = applyPlanAmendments(plans, exercise, planPrompt.affected, exercises, completions);
    setPlans(next);
    savePlans(next);
    for (const { key } of planPrompt.affected) pushDayPlan(key, next[key]);
    setPlanPrompt(null);
  }, [planPrompt, plans, completions]);

  // `date` (optional) opens the exercise as a log entry for that day; omitted
  // for the normal today/library flow. `fromSheet` marks that it was opened
  // from the "Log another" sheet, so the detail layers over that sheet (#86).
  const openExercise = useCallback((exercise, date = null, fromSheet = false) => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    // ?ex= rides along on the pushed entry so a reload restores the open
    // exercise; back/edge-swipe reverts to the previous (list) entry, whose
    // URL has no ?ex, so it clears naturally without extra bookkeeping.
    window.history.pushState({ exerciseId: exercise.id }, '', exerciseUrl(exercise.id));
    setDetailClosing(false);
    setLogDate(date);
    setDetailFromSheet(fromSheet);
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
    window.history.replaceState({ exerciseId: exercise.id }, '', exerciseUrl(exercise.id));
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
            plans={plans}
            todayModel={todayModel}
            onOpenExercise={openExercise}
            onLogForDate={handleLogForDate}
          />
        )}
        {tab === TAB_ALL && (
          <AllExercises completions={completions} onOpenExercise={openExercise} />
        )}
        {tab === TAB_PROGRESS && (
          <ProgressView
            completions={completions}
            plans={plans}
            todayModel={todayModel}
            onOpenExercise={openExercise}
          />
        )}
        <BuildInfo onRefresh={handleRefresh} wakeStatus={wakeStatus} />
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
          elevated={detailFromSheet}
        />
      )}

      {planPrompt && (
        <PlanAmendmentSheet
          exerciseName={exerciseById.get(planPrompt.exerciseId)?.name || 'this exercise'}
          affected={planPrompt.affected}
          onKeep={dismissPlanPrompt}
          onUpdate={applyPlanUpdate}
        />
      )}
    </div>
  );
}
