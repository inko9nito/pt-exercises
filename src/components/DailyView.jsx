import { useMemo, useState } from 'react';
import ExerciseRow from './ExerciseRow.jsx';
import WeekStrip from './WeekStrip.jsx';
import AddExerciseSheet from './AddExerciseSheet.jsx';
import { CheckIcon, PlusIcon } from './Icons.jsx';
import { exercises, FREQ } from '../data/exercises.js';
import {
  isDueToday,
  isOptionalToday,
  isRelevantToday,
  isToday,
  getTodayCount,
  getPlanProgress,
  dateKey,
  getCompletionDateMap,
} from '../utils/tracker.js';

function formatDateLong(key) {
  const date = new Date(`${key}T00:00:00`);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export default function DailyView({ completions, onOpenExercise }) {
  const today = new Date();
  const todayKey = dateKey(today);
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [weekOffset, setWeekOffset] = useState(0);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const isViewingToday = selectedDate === todayKey;

  const dateLabel = today.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const { due, optional, completedToday, relevantIds } = useMemo(() => {
    const due = [];
    const optional = [];
    const completedToday = [];
    // A Set (rather than summing the three arrays' lengths) avoids
    // double-counting the one case where an exercise appears in both due
    // and completedToday (an hourly exercise whose cooldown already
    // elapsed again after an earlier session today). isRelevantToday is
    // the shared definition of "shows up somewhere on today's page" also
    // used by the Progress tab's ring, so the two never drift apart.
    const relevantIds = new Set();

    for (const ex of exercises) {
      const hist = completions[String(ex.id)] || [];
      const todayCount = getTodayCount(ex, completions);
      const dueToday = isDueToday(ex, completions);

      if (ex.freqType === FREQ.AS_NEEDED) {
        // Never a real obligation — always available, never required.
        optional.push(ex);
      } else if (ex.freqType === FREQ.MULTIPLE_DAILY) {
        const maxPerDay = ex.maxPerDay || 99;
        if (todayCount === 0) due.push(ex); // at least one session is the baseline
        else if (todayCount < maxPerDay) optional.push(ex); // extra reps are a bonus
        else completedToday.push(ex);
      } else if (dueToday) {
        if (isOptionalToday(ex, completions)) optional.push(ex);
        else due.push(ex);
        // An hourly exercise done earlier today can already be due again by
        // the time its cooldown elapses — keep it visible in "Completed
        // today" too instead of dropping it the moment it reappears in "to
        // do", otherwise the earlier session disappears without a trace.
        if (hist.some(isToday)) completedToday.push(ex);
      } else if (hist.some(isToday)) {
        completedToday.push(ex);
      }
      // Otherwise it's simply not due today — nothing to show here; it's
      // still visible any time in "All exercises".

      if (isRelevantToday(ex, completions)) relevantIds.add(ex.id);
    }

    return { due, optional, completedToday, relevantIds };
  }, [completions]);

  // Same plan/bonus split the Progress ring uses, so the two never disagree
  // about how much of today is "done".
  const { planTotal, planDone, bonusDone } = useMemo(
    () => getPlanProgress(exercises, completions),
    [completions]
  );

  // Exercises whose schedule doesn't put them on today's page at all (e.g.
  // every-3-days ones not due yet) — surfaced via "Log another exercise" so
  // an unscheduled session (vet visit, one-off extra rep) doesn't require
  // digging through the All Exercises tab to find.
  const notScheduledToday = useMemo(
    () => exercises.filter((ex) => !relevantIds.has(ex.id)),
    [relevantIds]
  );

  // Due/optional/not-due status is only meaningful for today — a past or
  // future day in the week strip just shows what was actually logged then,
  // the same read-only "day detail" pattern the Progress tab's calendar uses.
  const dateMap = useMemo(() => getCompletionDateMap(completions, exercises), [completions]);
  const selectedDayItems = !isViewingToday ? dateMap.get(selectedDate) || [] : null;

  return (
    <div className="daily-view">
      <WeekStrip
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        weekOffset={weekOffset}
        onWeekChange={setWeekOffset}
        completions={completions}
      />

      {!isViewingToday ? (
        <div className="day-detail-view">
          <p className="day-detail-title">{formatDateLong(selectedDate)}</p>
          {selectedDayItems.length > 0 ? (
            <div className="day-detail-list">
              {selectedDayItems.map((item, i) => (
                <div key={i} className="day-detail-item">
                  <span className="day-detail-name">{item.name}</span>
                  <span className="day-detail-time">{item.time}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="day-detail-empty">Nothing logged this day.</p>
          )}
        </div>
      ) : (
        <>
          <div className="daily-summary">
            <div className="daily-date">{dateLabel}</div>
            <div className="daily-count-row">
              <span className="daily-count-done">{planDone}</span>
              <span className="daily-count-sep">/</span>
              <span className="daily-count-total">{planTotal}</span>
              <span className="daily-count-label">exercises done today</span>
              {bonusDone > 0 && <span className="daily-count-bonus">+{bonusDone} extra</span>}
            </div>
          </div>

          {due.length === 0 ? (
            <div className="all-done-state">
              <div className="all-done-icon">
                <CheckIcon size={26} />
              </div>
              <p className="all-done-title">All caught up</p>
              <p className="all-done-sub">Check back later for Domino's next session.</p>
            </div>
          ) : (
            <>
              <div className="section-label">
                To do
                <span className="section-count">{due.length}</span>
              </div>
              <div className="row-group">
                {due.map((ex) => (
                  <ExerciseRow
                    key={ex.id}
                    exercise={ex}
                    completions={completions}
                    onOpen={onOpenExercise}
                  />
                ))}
              </div>
            </>
          )}

          {optional.length > 0 && (
            <>
              <div className="section-label" style={{ marginTop: 28 }}>
                Optional
                <span className="section-count">{optional.length}</span>
              </div>
              <div className="row-group">
                {optional.map((ex) => (
                  <ExerciseRow
                    key={ex.id}
                    exercise={ex}
                    completions={completions}
                    onOpen={onOpenExercise}
                  />
                ))}
              </div>
            </>
          )}

          <button className="add-exercise-btn" onClick={() => setShowAddSheet(true)}>
            <PlusIcon size={16} />
            Log another exercise
          </button>

          {completedToday.length > 0 && (
            <>
              <div className="section-label" style={{ marginTop: 28 }}>
                Completed today
                <span className="section-count">{completedToday.length}</span>
              </div>
              <div className="row-group">
                {completedToday.map((ex) => (
                  <ExerciseRow
                    key={ex.id}
                    exercise={ex}
                    completions={completions}
                    onOpen={onOpenExercise}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {showAddSheet && (
        <AddExerciseSheet
          exercises={notScheduledToday}
          completions={completions}
          onOpenExercise={(ex) => {
            setShowAddSheet(false);
            onOpenExercise(ex);
          }}
          onClose={() => setShowAddSheet(false)}
        />
      )}
    </div>
  );
}
