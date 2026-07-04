import { FREQ } from '../data/exercises.js';

const STORAGE_KEY = 'domino_completions';
const PLANS_STORAGE_KEY = 'domino_plans';

// Firebase RTDB can hand back null for a per-exercise history that's been
// emptied out entirely (e.g. every session for it was undone) rather than
// [], and that malformed shape gets persisted to localStorage via
// saveCompletions() just like anything else — so this needs to run on data
// coming from either source, not just fresh Firebase snapshots.
export function normalizeCompletions(raw) {
  const normalized = {};
  for (const [id, history] of Object.entries(raw || {})) {
    normalized[id] = Array.isArray(history) ? history : [];
  }
  return normalized;
}

// Firebase's onValue can fire with an empty placeholder snapshot before its
// *authoritative* payload arrives (most visible right after a hard reload,
// which wipes the SDK's in-memory cache along with everything else) —
// ".info/connected" flipping true only proves the socket is up, not that the
// real payload has landed, so it can't be used to grant trust. Only a real,
// non-empty snapshot is allowed to establish trust; once it has, later
// legitimate empty snapshots (e.g. everything was undone) are trusted too —
// trust only ever ratchets on, never back off.
export function shouldTrustRemoteSnapshot(remote, alreadyTrusted) {
  return alreadyTrusted || Object.keys(remote).length > 0;
}

export function loadCompletions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return normalizeCompletions(raw ? JSON.parse(raw) : {});
  } catch {
    return {};
  }
}

export function saveCompletions(completions) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(completions));
}

// ── Plan snapshots (issue #53) ───────────────────────────────────────────
// A `plans` object mirrors `completions`: keyed by 'YYYY-MM-DD', each value is
// a stored record of what was *prescribed* that day, so past days stop being
// re-interpreted under today's frequency rules. Shape:
//   { exercises: { [id]: { target } }, amendments: {}, source, createdAt }
// Firebase RTDB drops empty objects, so a day with nothing scheduled comes
// back without an `exercises` key — normalizePlans fills the defaults back in.
export function normalizePlans(raw) {
  const out = {};
  for (const [key, plan] of Object.entries(raw || {})) {
    if (!plan || typeof plan !== 'object') continue;
    out[key] = {
      exercises:
        plan.exercises && typeof plan.exercises === 'object' ? plan.exercises : {},
      amendments:
        plan.amendments && typeof plan.amendments === 'object' ? plan.amendments : {},
      source: plan.source || 'live',
      createdAt: plan.createdAt || '',
    };
  }
  return out;
}

export function loadPlans() {
  try {
    const raw = localStorage.getItem(PLANS_STORAGE_KEY);
    return normalizePlans(raw ? JSON.parse(raw) : {});
  } catch {
    return {};
  }
}

export function savePlans(plans) {
  localStorage.setItem(PLANS_STORAGE_KEY, JSON.stringify(plans));
}

// A local Date at noon for a 'YYYY-MM-DD' key — noon so day arithmetic never
// trips over a DST boundary.
export function dateFromKey(key) {
  return new Date(`${key}T12:00:00`);
}

// Sessions prescribed for a single day: 1 for daily/interval/eod, the daily
// cap for multiple-daily, the daily target for hourly. Stored per-exercise in
// a snapshot (feeds x/N badges); the ring denominator still counts exercises,
// not sessions, so the plan-vs-bonus ring math is unchanged.
export function planTarget(exercise) {
  switch (exercise.freqType) {
    case FREQ.MULTIPLE_DAILY:
      return exercise.maxPerDay || 3;
    case FREQ.HOURLY:
      return exercise.dailyTarget || 1;
    default:
      return 1;
  }
}

// Compute the plan snapshot for `date` from the current history, using the
// same isScheduledOn semantics the rings used to reconstruct live. `source`
// is 'live' (today's write-once snapshot) or 'backfilled' (a past day filled
// in retroactively). amendments starts empty — schema room for #27.
export function buildPlanSnapshot(exercises, completions, date, source) {
  const exMap = {};
  for (const ex of exercises) {
    if (isScheduledOn(ex, completions, date)) {
      exMap[String(ex.id)] = { target: planTarget(ex) };
    }
  }
  return {
    exercises: exMap,
    amendments: {},
    source,
    createdAt: new Date().toISOString(),
  };
}

// Every day from the earliest completion through yesterday, plus today, that
// has no stored snapshot yet. One code path serves both the one-time backfill
// and lazy fill of any gap day the app wasn't opened on; checking existence
// keeps it write-once and idempotent.
export function missingPlanDays(completions, plans, today = new Date()) {
  const plansObj = plans || {};
  const todayKey = dateKey(today);
  const days = [];

  let earliest = null;
  for (const arr of Object.values(completions)) {
    for (const iso of arr || []) {
      const k = dateKey(new Date(iso));
      if (earliest === null || k < earliest) earliest = k;
    }
  }
  if (earliest !== null) {
    const cursor = dateFromKey(earliest);
    while (dateKey(cursor) < todayKey) {
      const k = dateKey(cursor);
      if (!plansObj[k]) days.push(k);
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  if (!plansObj[todayKey]) days.push(todayKey);
  return days;
}

export function markDone(completions, exerciseId) {
  const id = String(exerciseId);
  const prev = completions[id] || [];
  return { ...completions, [id]: [...prev, new Date().toISOString()] };
}

// Retroactively log a session on a past day (for something that was done but
// forgotten). Stamped at local noon since the exact time doesn't matter, and
// the history is kept chronologically sorted so "last done" (history's last
// element) stays the most recent session even after a back-dated insert.
export function markDoneOn(completions, exerciseId, date) {
  const id = String(exerciseId);
  const prev = completions[id] || [];
  const stamp = new Date(date);
  stamp.setHours(12, 0, 0, 0);
  const next = [...prev, stamp.toISOString()].sort();
  return { ...completions, [id]: next };
}

// Remove a single logged session on a specific day (the most recent one that
// day). Used both for the exercise-detail "Undo" (scoped to today, so it can
// never reach back and delete a prior day's session — see issue #43) and for
// reviewing a past day's log and pulling out an entry.
export function removeSessionOn(completions, exerciseId, date) {
  const id = String(exerciseId);
  const history = completions[id] || [];
  const key = dateKey(date);
  let idx = -1;
  for (let i = history.length - 1; i >= 0; i--) {
    if (dateKey(new Date(history[i])) === key) {
      idx = i;
      break;
    }
  }
  if (idx === -1) return completions;
  return { ...completions, [id]: [...history.slice(0, idx), ...history.slice(idx + 1)] };
}

export function countSessionsOn(completions, exerciseId, date) {
  return getSessionsOn(completions, exerciseId, date).length;
}

export function daysBetween(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
}

export function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Date.getDay() is Sunday-start (0 = Sunday); every calendar view in this app
// (week strip, month calendar) starts the week on Monday instead.
export function mondayIndex(date) {
  return (date.getDay() + 6) % 7;
}

export function isToday(isoString) {
  return dateKey(new Date(isoString)) === dateKey(new Date());
}

// Every predicate below needs some version of "which sessions fall on day X"
// or "what's the most recent session before day X", and a naive
// implementation re-parses every ISO string in a history on every call —
// cheap for one exercise once, expensive across 20 exercises × several
// predicates × every render. This index is built once per history array and
// cached by array *reference*: completions updates only replace the edited
// exercise's array (`{ ...completions, [id]: next }`), so every other
// exercise's array reference — and its cached index — survives untouched.
const historyIndexCache = new WeakMap();

function getHistoryIndex(history) {
  let index = historyIndexCache.get(history);
  if (index) return index;

  const byDay = new Map();
  // history is kept chronologically sorted (see markDone/markDoneOn), so a
  // single pass both buckets sessions by day and keeps each day's bucket in
  // chronological order.
  for (const iso of history) {
    const key = dateKey(new Date(iso));
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(iso);
  }
  const dayKeys = Array.from(byDay.keys()).sort();
  index = { byDay, dayKeys };
  historyIndexCache.set(history, index);
  return index;
}

// The most recent session strictly before `date`, or null if there isn't
// one — a binary search over the (typically much shorter) list of distinct
// days-with-a-session, instead of filtering every individual session.
function lastSessionBefore(history, date) {
  const { byDay, dayKeys } = getHistoryIndex(history);
  const key = dateKey(date);
  let lo = 0;
  let hi = dayKeys.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (dayKeys[mid] < key) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (found === -1) return null;
  const sessions = byDay.get(dayKeys[found]);
  return sessions[sessions.length - 1];
}

export function getSessionsOn(completions, exerciseId, date) {
  const history = completions[String(exerciseId)] || [];
  return getHistoryIndex(history).byDay.get(dateKey(date)) || [];
}

export function isDueToday(exercise, completions) {
  const id = String(exercise.id);
  const history = completions[id] || [];
  const today = new Date();

  switch (exercise.freqType) {
    case FREQ.DAILY:
    case FREQ.DAILY_OR_EOD: {
      return getSessionsOn(completions, exercise.id, today).length === 0;
    }

    case FREQ.EVERY_OTHER_DAY:
    case FREQ.EVERY_3_DAYS:
    case FREQ.TWICE_WEEKLY: {
      if (history.length === 0) return true;
      const last = history[history.length - 1];
      return daysBetween(last, today) >= exercise.freqDays;
    }

    case FREQ.MULTIPLE_DAILY: {
      const todayCount = getTodayCount(exercise, completions);
      return todayCount < (exercise.maxPerDay || 3);
    }

    case FREQ.HOURLY: {
      if (exercise.dailyTarget) {
        const todayCount = getTodayCount(exercise, completions);
        if (todayCount >= exercise.dailyTarget) return false;
      }
      if (history.length === 0) return true;
      const last = new Date(history[history.length - 1]);
      const minutesSince = (today - last) / (1000 * 60);
      return minutesSince >= (exercise.freqMinutes || 90);
    }

    case FREQ.AS_NEEDED:
    default:
      return true;
  }
}

// "Daily to every other day" exercises are only optional on a given day if
// they were done the day before — skipping today still keeps the every-other-day
// minimum, whereas skipping two days in a row would not.
export function isOptionalToday(exercise, completions) {
  if (exercise.freqType !== FREQ.DAILY_OR_EOD) return false;
  const id = String(exercise.id);
  const history = completions[id] || [];
  if (history.length === 0) return false;
  if (getSessionsOn(completions, exercise.id, new Date()).length > 0) return false;
  const last = history[history.length - 1];
  return daysBetween(last, new Date()) === 1;
}

// For "every 1-2 hours" exercises, estimate when it'll be due again so the
// UI can show "next due ~2:45 PM" instead of leaving the gap unexplained.
export function getNextDueEstimate(exercise, completions) {
  if (exercise.freqType !== FREQ.HOURLY) return null;
  const id = String(exercise.id);
  const history = completions[id] || [];
  if (history.length === 0) return null;
  if (exercise.dailyTarget && getTodayCount(exercise, completions) >= exercise.dailyTarget) return null;
  const last = new Date(history[history.length - 1]);
  const next = new Date(last.getTime() + (exercise.freqMinutes || 90) * 60000);
  if (next <= new Date()) return null;
  return next;
}

// Whether an exercise shows up anywhere on today's page at all — due,
// optional, or already completed today. Drives which rows render on the
// Today tab and which exercises the "Log another exercise" picker offers
// (everything NOT relevant today). This is deliberately broader than the
// progress *plan* below: an optional or a bonus-logged exercise is shown,
// but it isn't part of the prescribed plan.
export function isRelevantToday(exercise, completions) {
  if (exercise.freqType === FREQ.AS_NEEDED || exercise.freqType === FREQ.MULTIPLE_DAILY) return true;
  if (isDueToday(exercise, completions)) return true;
  return getTodayCount(exercise, completions) > 0;
}

// Whether an exercise is part of today's *prescribed plan* — independent of
// whether it's already been done today. This is the honest denominator for
// the progress ring: doing a bonus/unscheduled exercise must never inflate
// the plan, and completing a scheduled one must never shrink it out of the
// plan. The distinction plain isDueToday can't make is that a daily
// exercise stops being "due" the moment it's done, yet it was still on
// that day's plan — so scheduling is computed only from sessions on *other*
// days, which also lets it be reconstructed for any past day (the week
// strip's per-day rings) purely from history.
function doneOn(history, date) {
  return getHistoryIndex(history).byDay.has(dateKey(date));
}

export function isScheduledOn(exercise, completions, date) {
  const history = completions[String(exercise.id)] || [];

  switch (exercise.freqType) {
    case FREQ.DAILY:
    case FREQ.MULTIPLE_DAILY:
    case FREQ.HOURLY:
      // Part of every day's routine; counts as plan-done once it's had at
      // least one session that day.
      return true;

    case FREQ.DAILY_OR_EOD: {
      // Baseline is daily, but doing it the day before already satisfies the
      // every-other-day floor and makes this day genuinely optional — not
      // part of the plan (doing it anyway is bonus).
      const prev = new Date(date);
      prev.setDate(prev.getDate() - 1);
      return !doneOn(history, prev);
    }

    case FREQ.EVERY_OTHER_DAY:
    case FREQ.EVERY_3_DAYS:
    case FREQ.TWICE_WEEKLY: {
      // Due on this day if the last session *before* it is at least the
      // cadence gap back (or there was none yet).
      const last = lastSessionBefore(history, date);
      if (last === null) return true;
      return daysBetween(last, date) >= exercise.freqDays;
    }

    case FREQ.AS_NEEDED:
    default:
      // Never a prescribed obligation — any session is bonus/extra credit.
      return false;
  }
}

export function isScheduledToday(exercise, completions) {
  return isScheduledOn(exercise, completions, new Date());
}

// Splits a given day's activity into two non-fungible currencies:
//   planTotal  — exercises prescribed that day (independent of completion)
//   planDone   — how many of those are done (never exceeds planTotal, so a
//                ring can't overflow on scheduled work and the "flourish" is
//                earned only by actually finishing the plan)
//   bonusDone  — exercises done that day that were NOT on the plan (optional
//                or unscheduled/"logged another"), surfaced separately so
//                extra work is visible without silently papering over a
//                skipped scheduled exercise.
// When a stored snapshot exists for the day, the plan is read from it (a
// recorded fact) instead of reconstructed — so an exercise's frequency
// changing, or a new exercise being added, no longer rewrites what past days
// were "supposed" to be. Days without a snapshot (pre-#53 history not yet
// backfilled, or a wiped remote) fall back to live reconstruction, identical
// to the old behavior. Passing no `plans` is also a valid fallback.
export function getPlanProgressOn(exercises, completions, date, plans) {
  const snap = plans && plans[dateKey(date)];
  if (snap) return planProgressFromSnapshot(exercises, completions, date, snap);

  let planTotal = 0;
  let planDone = 0;
  let bonusDone = 0;
  for (const ex of exercises) {
    const done = doneOn(completions[String(ex.id)] || [], date);
    if (isScheduledOn(ex, completions, date)) {
      planTotal += 1;
      if (done) planDone += 1;
    } else if (done) {
      bonusDone += 1;
    }
  }
  return { planTotal, planDone, bonusDone };
}

function planProgressFromSnapshot(exercises, completions, date, snap) {
  const known = new Set(exercises.map((e) => String(e.id)));
  // amendments.postponed (schema room for #27) removes an exercise from the
  // day's plan denominator; none exist yet.
  const postponed = (snap.amendments && snap.amendments.postponed) || {};
  const plannedIds = new Set();
  let planTotal = 0;
  let planDone = 0;
  for (const id of Object.keys(snap.exercises || {})) {
    // Skip an id that's since been removed from the exercise library — it
    // can't be rendered or completed, so it shouldn't sit in a day's
    // denominator forever.
    if (!known.has(id) || postponed[id]) continue;
    plannedIds.add(id);
    planTotal += 1;
    if (doneOn(completions[id] || [], date)) planDone += 1;
  }
  let bonusDone = 0;
  for (const ex of exercises) {
    const id = String(ex.id);
    if (plannedIds.has(id)) continue;
    if (doneOn(completions[id] || [], date)) bonusDone += 1;
  }
  return { planTotal, planDone, bonusDone };
}

export function getPlanProgress(exercises, completions, plans) {
  return getPlanProgressOn(exercises, completions, new Date(), plans);
}

// Whether a session on `date` was "extra" (not on that day's plan) — drives
// the Extra badge. Reads the stored snapshot when present, else falls back to
// live reconstruction, matching getPlanProgressOn.
export function isExtraOn(exercise, completions, date, plans) {
  const snap = plans && plans[dateKey(date)];
  if (snap) {
    const postponed = (snap.amendments && snap.amendments.postponed) || {};
    const id = String(exercise.id);
    return !(snap.exercises && snap.exercises[id] && !postponed[id]);
  }
  return !isScheduledOn(exercise, completions, date);
}

// How many days past its due date a currently-due exercise is (0 = due today
// / on time, or not applicable). Counts consecutive prior days — starting
// yesterday — on which it was scheduled and not done; for interval exercises
// that equals the number of days since its due date. Exercises never done
// before today have no baseline to measure from, so they return 0 rather
// than an astronomically large count. Multiple-daily/hourly reset each day
// and as-needed is never owed, so they never accrue overdue days.
export function getDaysOverdue(exercise, completions) {
  if (
    exercise.freqType === FREQ.MULTIPLE_DAILY ||
    exercise.freqType === FREQ.HOURLY ||
    exercise.freqType === FREQ.AS_NEEDED
  ) {
    return 0;
  }
  const history = completions[String(exercise.id)] || [];
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  // dayKeys is sorted ascending, so the earliest day-with-a-session is
  // dayKeys[0] — an O(1) check instead of scanning every session.
  const { dayKeys } = getHistoryIndex(history);
  if (dayKeys.length === 0 || dayKeys[0] >= dateKey(startOfToday)) return 0;

  let count = 0;
  const cursor = new Date();
  for (let i = 0; i < 365; i++) {
    cursor.setDate(cursor.getDate() - 1);
    if (isScheduledOn(exercise, completions, cursor) && !doneOn(history, cursor)) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

export function getTodayCount(exercise, completions) {
  return getSessionsOn(completions, exercise.id, new Date()).length;
}

export function getLastDone(exercise, completions) {
  const id = String(exercise.id);
  const history = completions[id] || [];
  if (history.length === 0) return null;
  return new Date(history[history.length - 1]);
}

export function getTotalSessions(completions) {
  // Firebase RTDB can hand back null for a history that's been emptied out
  // (e.g. every session for that exercise was undone) rather than [], so
  // this can't assume every value is an array.
  return Object.values(completions).reduce((sum, arr) => sum + (arr || []).length, 0);
}

export function getStreak(completions) {
  const dates = new Set();
  for (const arr of Object.values(completions)) {
    for (const iso of arr || []) dates.add(dateKey(new Date(iso)));
  }

  const cursor = new Date();
  if (!dates.has(dateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  while (dates.has(dateKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function getCompletionDateMap(completions, exercises) {
  const map = new Map();
  for (const ex of exercises) {
    const history = completions[String(ex.id)] || [];
    for (const iso of history) {
      const d = new Date(iso);
      const key = dateKey(d);
      const entry = {
        id: ex.id,
        name: ex.name,
        time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sortMs: d.getTime(),
      };
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(entry);
    }
  }
  for (const arr of map.values()) {
    arr.sort((a, b) => a.sortMs - b.sortMs);
  }
  return map;
}

function formatSessionTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// The full plan-vs-actual picture for a single day, for the past-day log
// views — so a past day reads like Today (its planned exercises shown
// alongside what was completed) instead of listing only what happened to be
// logged (issue #53). Order mirrors Today: missed planned exercises first
// (the day's unfinished "to do"), then completed plan exercises, then any
// extra sessions. `plans` chooses the snapshot vs live-reconstruction path
// exactly like getPlanProgressOn/isExtraOn.
export function getDayEntries(exercises, completions, plans, date) {
  // "Missed" only makes sense once a day is over — today isn't a miss until
  // it ends, and a future day certainly isn't. So planned-but-not-done rows
  // are shown only for strictly-past days; today/future show just what's
  // actually been logged (matching the old completed-only past behavior).
  const showMissed = dateKey(date) < dateKey(new Date());
  const missed = [];
  const donePlanned = [];
  const doneExtra = [];
  for (const ex of exercises) {
    const sessions = getSessionsOn(completions, ex.id, date);
    const onPlan = !isExtraOn(ex, completions, date, plans);
    if (sessions.length > 0) {
      const entry = {
        id: ex.id,
        name: ex.name,
        freqLabel: ex.freqLabel,
        done: true,
        extra: !onPlan,
        times: sessions.map(formatSessionTime),
      };
      (onPlan ? donePlanned : doneExtra).push(entry);
    } else if (onPlan && showMissed) {
      missed.push({
        id: ex.id,
        name: ex.name,
        freqLabel: ex.freqLabel,
        done: false,
        extra: false,
        times: [],
      });
    }
  }
  return [...missed, ...donePlanned, ...doneExtra];
}

// Groups a day's raw completion-map entries (one per session, from
// getCompletionDateMap) into one card per exercise, carrying every time it
// was done that day — so an exercise done multiple times renders as a single
// row rather than one row per session.
export function groupDayCards(dateMap, dateKeyForDay) {
  const byId = new Map();
  for (const item of dateMap.get(dateKeyForDay) || []) {
    if (!byId.has(item.id)) byId.set(item.id, { id: item.id, times: [] });
    byId.get(item.id).times.push(item.time);
  }
  return Array.from(byId.values());
}
