# Optimization & Cleanup Plan — Domino PT Exercises

A plan for a follow-up implementer (Sonnet) to reduce inefficiency, remove
dead code, and de-duplicate logic **without changing user-visible behavior**,
except where an open issue explicitly asks for a behavior change.

## 0. Orientation (read first)

- **App:** Vite + React 18 PWA. A single-dog physical-therapy tracker
  ("Domino"). Deployed to GitHub Pages (`base: '/pt-exercises/'`), state synced
  through Firebase Realtime Database.
- **Where the code lives:** the application source is on branch
  `claude/domino-exercise-tracker-f65rsa`. The repo's `main` branch is empty
  (README only). This plan branch (`claude/sonnet-optimization-plan-yejjwt`) is
  based on the code branch so the plan sits alongside the code it describes.
- **Shape:** ~20 exercises defined statically in `src/data/exercises.js`. All
  completion state is one object, `completions: { [exerciseId]: string[] }`
  (arrays of ISO timestamps), threaded top-down from `App.jsx` into every view.
- **Source-of-truth files for the domain logic:** `src/utils/tracker.js` (pure
  functions), `src/utils/sync.js` (Firebase), `src/App.jsx` (state + history/URL
  plumbing).

### Guardrails

1. **Behavior-preserving by default.** The scheduling/plan-vs-bonus rules in
   `tracker.js` encode a lot of hard-won edge cases (see the long comments).
   Preserve them. Refactors here are about *how* the values are computed, not
   *what* they are.
2. **Keep the explanatory comments.** Several document real bugs that were fixed
   (the Firebase empty-snapshot stomp, the iOS edge-swipe double-animation, the
   GitHub Pages `index.html` cache-bust). Carry them across refactors.
3. **Land in small, reviewable PRs** in the order below. Each workstream is
   independently shippable.
4. **Add a safety net first (Workstream A0)** so behavior-preserving refactors
   can be verified.

---

## Workstream A — Tooling & safety net (do this first)

There is currently **no linter, no formatter, and no tests**. Every refactor
below is easier and safer with a net.

- **A0. Unit tests for `tracker.js`.** These are pure functions and the highest
  risk surface — add Vitest and cover the tricky ones with fixed clocks:
  `isDueToday`, `isScheduledOn`, `isOptionalToday`, `getPlanProgressOn`,
  `getDaysOverdue`, `getStreak`, `getNextDueEstimate`, `getCompletionDateMap`,
  `removeSessionOn`/`markDoneOn` (chronological insert). Cover each `FREQ.*`
  branch. This test suite becomes the contract the rest of the plan refactors
  against.
- **A1. ESLint** (`eslint-plugin-react-hooks` especially) + Prettier, wired to a
  `lint` script. This will flag the real hook-dependency gaps noted below.
- **A2. SessionStart hook** (`.claude/` — see the `session-start-hook` skill) so
  web sessions can run `npm ci && npm run build && npm test` reproducibly.

Acceptance: `npm test` and `npm run lint` pass in CI/hook.

---

## Workstream B — Performance

The app is small so nothing is *slow* today, but the compute patterns are
quadratic-to-cubic in disguise and will degrade as history grows. All of this
is invisible to the user when done right.

### B1. Build one date-indexed view of `completions`, once.

Today, nearly every predicate re-parses every ISO string. `dateKey(new Date(iso))`
is called in tight loops across `isScheduledOn`, `doneOn`, `sessionsBefore`,
`countSessionsOn`, `isToday`, `getStreak`, `getCompletionDateMap`, etc.
`new Date(...)` + `getFullYear/getMonth/getDate` runs thousands of times per
render.

**Fix:** derive a normalized index from `completions` once (memoized on the
`completions` reference) and feed it to the predicates:

```
// e.g. { [id]: { sortedIso: string[], byDay: Map<'YYYY-MM-DD', count>, dayKeys: string[] } }
```

Then `doneOn`, `countSessionsOn`, `sessionsBefore`, "last done", and per-day
grouping become Map lookups instead of full scans + reparse. Keep the existing
`tracker.js` function signatures as thin wrappers (so tests and call sites don't
churn), or introduce a `buildIndex(completions)` + index-taking variants.

### B2. Kill the O(365 × history) overdue scan.

`getDaysOverdue` loops up to 365 days and calls `isScheduledOn` each iteration,
and `isScheduledOn` itself scans the whole history and reparses dates
(`sessionsBefore`). It's called **per due row** in `DailyView`. With the B1
index this collapses to a bounded walk over `dayKeys`. At minimum, precompute
the schedule inputs outside the loop.

### B3. Compute `getCompletionDateMap` once and share it.

It's built independently in **both** `DailyView` and `ProgressView` (identical
call, `getCompletionDateMap(completions, exercises)`). Lift it to a shared
memo/context (see D2) so it's computed once per `completions` change, not twice.

### B4. Stop recomputing per-row status that the parent already knows.

`DailyView` already buckets each exercise into due/laterToday/optional/completed,
then `ExerciseRow` re-derives `isDueToday`, `isOptionalToday`,
`getNextDueEstimate`, `todayCount` for the *same* exercise. Pass the computed
status down (or compute a per-row view-model in the parent's single pass) rather
than recomputing inside each row.

### B5. Memoize components and callbacks.

- Wrap `ExerciseRow`, `WeekStrip`'s day button, `MonthCalendar` cells, and the
  logged-day card (see D1) in `React.memo`.
- `WeekStrip` calls `getPlanProgressOn` **7× per render** (once per day) and
  `MonthCalendar` renders ~42 cells; with B1 + memo these stop re-running on
  unrelated state changes (e.g. typing in the All-exercises search box, which
  today re-renders far more than it should because `completions` identity is
  stable but nothing is memoized).

### B6. Firebase write model.

`pushCompletions` does a full `set()` of the **entire** completions tree on
every single action (`markDone`, `undo`, `removeSessionOn`, `markDoneOn`). This
is a last-write-wins clobber and grows with total history. Consider writing at
the per-exercise path (`ref(db, 'completions/'+id)`) or using `update()` with a
scoped payload so one logged session doesn't rewrite everyone's whole tree.
(Coordinate with the trust-guard hack in `App.jsx`, C4.)

---

## Workstream C — Dead code & issue-driven cleanup

### C1. Remove indoor/outdoor everywhere — **Issue #33 (open).**

"Remove indoors / outdoors everywhere - not useful." This deletes a whole
concept currently threaded through the codebase:

- `src/data/exercises.js`: the `LOCATION`, `LOCATION_LABEL` maps and the
  `location:` field on all 20 exercises.
- `src/components/AllExercises.jsx`: the `indoor` / `outdoor` filter chips (and
  their `HomeIcon` / `TreeIcon`). Decide whether `equipment`/`no-equipment`
  filters stay (they're independent and useful).
- `src/components/ExerciseRow.jsx` and `ExerciseDetail.jsx`: the
  `LOCATION_LABEL[...]` meta line ("· Indoors").
- `src/components/Icons.jsx`: `HomeIcon`, `TreeIcon` become dead — remove.

This is the single biggest dead-code deletion and directly closes an open issue.

### C2. De-duplicate shared constants/helpers.

- `exerciseById = new Map(exercises.map(...))` is defined identically in
  `DailyView.jsx` and `ProgressView.jsx`. Export it once from
  `data/exercises.js` (or a small `data` selector module).
- `formatDateLong(key)` is defined identically in `DailyView.jsx` and
  `ProgressView.jsx`. Move to a `utils/format.js` (alongside `formatLastDone`).
- `WEEKDAY_LABELS` (`['Mon'...'Sun']`) is duplicated in `WeekStrip.jsx` and
  `MonthCalendar.jsx`, as is the Monday-start index math `(getDay()+6)%7`.
  Centralize in a date util.

### C3. Extract the duplicated "logged-day card list" — see also D1.

The past-day card list (thumb / name / times / Extra badge / check / chevron)
is **copy-pasted** between `DailyView.jsx` (`selectedDayCards` render, ~lines
146–183) and `ProgressView.jsx` (`day.cards` render, ~lines 97–135) — ~35 nearly
identical lines each, including the identical `isScheduledOn(...)` "extra"
computation and the identical "group sessions by exercise into cards" reducer.
Extract a `<DayLogList completions date cards onOpen />` component (and a
`groupDayCards(dateMap, dateKey)` helper). Removes ~70 lines and a whole class
of drift bugs.

### C4. Simplify the Firebase "trusted remote" guard once B6 lands.

`App.jsx` carries a `trustedRemoteRef` dance to stop an empty placeholder
snapshot from stomping good localStorage. It's correct but fragile and coupled
to the full-tree `set()` model. Revisit after B6; at minimum add the missing
test coverage for the "empty snapshot before authoritative payload" race.

---

## Workstream D — Structural / architectural

### D1. A single computed "today model."

`DailyView` derives due/laterToday/optional/completed/relevantIds in one pass,
`ProgressView` derives its own day model, and `App` owns raw `completions`.
Introduce one memoized selector layer (a `useMemo` in a small provider, or a
`useTodayModel(completions)` hook) that computes the buckets, the plan/bonus
totals, and the shared `dateMap` once, and hand typed view-models to the views.
This is what makes B3/B4/B5 clean instead of bolted-on.

### D2. Consider light Context for `completions`.

`completions` is prop-drilled into every view and `ExerciseDetail`. A small
context (state stays in `App`) removes the drilling and, combined with
`React.memo`, stops unrelated subtrees re-rendering. Low priority; do it only if
D1 doesn't already absorb it.

---

## Workstream E — Correctness cleanups surfaced while reviewing

These are small and worth folding in, but confirm against tests first.

- **E1. Issue #40 (open): as-needed breaks "All caught up."** Because "General
  neck massage" is `AS_NEEDED`, `DailyView` always pushes it into `optional`, so
  the `due.length === 0 && laterToday === 0 && optional === 0` "All caught up"
  state can never render while an as-needed exercise exists. Decide the intended
  rule (e.g. as-needed shouldn't block the caught-up state) and encode it — this
  is a behavior change the issue explicitly wants.
- **E2. `ExerciseCarousel`/`Lightbox` axis-lock vs `useSwipe`.** `ImageCarousel`
  hand-rolls its own axis-locked pointer gesture while `useSwipe` exists for
  `WeekStrip`. They're intentionally different (one drags a track, one is a
  threshold swipe) — **don't force a merge**, but document why, or extract the
  shared axis-lock primitive if it stays readable.
- **E3. `nextExercise = id + 1` coupling.** `ExerciseDetail` computes "Up next"
  as `exercise.id + 1`, assuming contiguous integer ids. Fine today; make it
  index-based against the `exercises` array so it can't silently break if an id
  is ever removed (relevant if #33's data edits renumber anything — they
  shouldn't, but note it).
- **E4. Issue #43 (open): undo can silently delete a past day's session.**
  `ExerciseDetail` renders its undo button whenever `history.length > 0` — even
  when nothing has been logged *today* — and `undoLast` removes the *globally
  most-recent* session. For an every-other-day exercise done Tuesday, opening
  it today shows "Log session" alongside an undo that deletes Tuesday's log.
  Fix: gate the undo button on `todayCount > 0`, and scope the action to
  today's sessions (route `onUndo` through
  `removeSessionOn(completions, id, new Date())` instead of `undoLast` — the
  same day-scoped helper #28 added; `undoLast` likely becomes dead code and
  can be removed). Add regression tests: undo hidden with no session today;
  undo with sessions on multiple days only removes today's. This is the
  highest-priority E item — it's live data loss.

---

## Explicitly OUT of scope for this cleanup pass

These open issues are **features/UX**, not optimization, and should be separate
tracked work (listed so the implementer doesn't scope-creep into them):
#3 (notes field), #13 (Today rollover logic), #18 (theme/colors), #24 (timer),
#25 (landscape/iPad responsiveness), #27 (postpone/reschedule), #35 (refresh
transition), #37 ("log another" sheet transition). Only **#33**, **#40**, and
**#43** are in scope here — cleanup/dead-code, a latent logic bug, and a
data-loss undo bug respectively.

---

## Suggested PR sequence

1. **PR1 — Safety net:** Vitest + `tracker.js` tests, ESLint/Prettier, session
   hook. (Workstream A)
2. **PR2 — Dead code:** remove indoor/outdoor (#33) + de-dupe constants/helpers.
   (C1, C2) — behavior-preserving except the intended #33 removal.
3. **PR3 — Shared components:** `DayLogList` extraction + shared today-model
   selector. (C3, D1)
4. **PR4 — Perf core:** `buildIndex(completions)` + rewire predicates, fix
   `getDaysOverdue`, `React.memo`. (B1, B2, B4, B5)
5. **PR5 — Sync:** scoped Firebase writes + simplify trust guard. (B6, C4)
6. **PR6 — Correctness:** #40 "All caught up", small E-series items. (E1–E3)

**Exception to the ordering:** E4 (#43) is live data loss — a mis-tap deletes a
past day's session. Ship it as a small hotfix PR **first** (or folded into PR1
with its regression tests); don't hold it behind the refactor train. The fix
only needs the existing `removeSessionOn` helper.

Each PR should keep `npm test` green; PRs 3–5 must not change any test
assertions (pure refactors). PR2 and PR6 update tests to match the intended
behavior changes.
