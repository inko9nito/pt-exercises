import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set } from 'firebase/database';
import { normalizeCompletions, loadCompletions, normalizePlans } from './tracker.js';

const firebaseConfig = {
  apiKey: 'AIzaSyD-CxVuiQ4k94KKixh4y8iPHRxlODCXY24',
  authDomain: 'domino-pt.firebaseapp.com',
  databaseURL: 'https://domino-pt-default-rtdb.firebaseio.com',
  projectId: 'domino-pt',
  storageBucket: 'domino-pt.firebasestorage.app',
  messagingSenderId: '649723955675',
  appId: '1:649723955675:web:4a179dbf7b1200edca7ffe',
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const completionsRef = ref(db, 'completions');
const plansRef = ref(db, 'plans');

export function subscribeToCompletions(onChange) {
  return onValue(completionsRef, (snapshot) => {
    onChange(normalizeCompletions(snapshot.val()));
  });
}

// Plan snapshots (issue #53), a sibling node to `completions`. Same
// subscribe-and-mirror model; writes are scoped to the one day's path
// (`plans/YYYY-MM-DD`) so filling a snapshot never rewrites the whole tree.
// Unlike completions, plan writes need no pending-write safeguard: a lost
// write just leaves that day missing, and missingPlanDays re-computes and
// re-writes it (identically) on the next load.
export function subscribeToPlans(onChange) {
  return onValue(plansRef, (snapshot) => {
    onChange(normalizePlans(snapshot.val()));
  });
}

export function pushDayPlan(dateKey, plan) {
  return set(ref(db, `plans/${dateKey}`), plan);
}

// A write is "pending" from the moment it's issued until Firebase acks it.
// The set of pending exercise ids is mirrored in localStorage so it survives
// a page teardown — specifically the rare *real* reload the keep-awake
// refresh hack can cause if its window.stop() lands late (issue #68 #2).
// RTDB writes go over a persistent WebSocket, which window.stop() does NOT
// abort — so a refresh *tick* can't lose a write. Only a full reload can,
// and only in the sliver between issuing a write and it reaching the socket:
// after such a reload the remote snapshot (missing that write) would
// overwrite the local cache via the trust logic. Re-pushing anything still
// marked pending on the next load closes that window; localStorage is the
// source of truth for a write that may never have reached the server.
const PENDING_KEY = 'domino_pending_writes';

function readPending() {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
}

function writePending(ids) {
  try {
    if (ids.length) localStorage.setItem(PENDING_KEY, JSON.stringify(ids));
    else localStorage.removeItem(PENDING_KEY);
  } catch {
    // No localStorage (e.g. under test) — the safeguard just no-ops.
  }
}

function markPending(id) {
  const ids = readPending();
  if (!ids.includes(id)) writePending([...ids, id]);
}

function clearPending(id) {
  const ids = readPending();
  if (ids.includes(id)) writePending(ids.filter((x) => x !== id));
}

// Writes only the one exercise's session history that actually changed,
// instead of the whole completions tree — logging or undoing one exercise
// used to re-upload every other exercise's full history too on every single
// action. Firebase's onValue on the parent `completions` path still sees the
// merged, up-to-date full tree regardless of which descendant path a write
// lands on, so this doesn't change anything about how subscribeToCompletions
// receives updates.
export function pushExerciseCompletions(exerciseId, history) {
  const id = String(exerciseId);
  // Mark pending *before* the write goes out; clear it only once the server
  // confirms. Promise.resolve() tolerates a mocked set() that returns
  // undefined (see sync.test.js) as well as Firebase's real Promise.
  markPending(id);
  return Promise.resolve(set(ref(db, `completions/${id}`), history)).then(
    () => clearPending(id),
    () => {
      // Write failed — leave it pending so replayPendingWrites retries it on
      // the next load rather than silently dropping it.
    }
  );
}

// Re-push any writes that were still pending when the page last went away.
// Called once on startup, before the remote subscription can overwrite the
// local cache, so the values re-pushed are the local ones that may not have
// reached the server. Re-pushing an already-synced value is idempotent (a
// set() to the same history), so a redundant replay is harmless.
export function replayPendingWrites() {
  const ids = readPending();
  if (!ids.length) return;
  const local = loadCompletions();
  for (const id of ids) {
    pushExerciseCompletions(id, local[id] || []);
  }
}
