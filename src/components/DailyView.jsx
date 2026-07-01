import { useMemo } from 'react';
import ExerciseRow from './ExerciseRow.jsx';
import { CheckIcon } from './Icons.jsx';
import { exercises, FREQ } from '../data/exercises.js';
import { isDueToday, isOptionalToday, isToday, getTodayCount } from '../utils/tracker.js';

export default function DailyView({ completions, onOpenExercise }) {
  const today = new Date();

  const dateLabel = today.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const { due, optional, completedToday } = useMemo(() => {
    const due = [];
    const optional = [];
    const completedToday = [];

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
    }

    return { due, optional, completedToday };
  }, [completions]);

  const doneCount = exercises.reduce((acc, ex) => {
    const hist = completions[String(ex.id)] || [];
    return acc + (hist.some(isToday) ? 1 : 0);
  }, 0);

  const progressPct = Math.round((doneCount / exercises.length) * 100);

  return (
    <div className="daily-view">
      <div className="daily-hero">
        <div className="daily-date">{dateLabel}</div>
        <div className="daily-count-row">
          <span className="daily-count-done">{doneCount}</span>
          <span className="daily-count-sep">/</span>
          <span className="daily-count-total">{exercises.length}</span>
          <span className="daily-count-label">exercises done today</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progressPct}%` }} />
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
    </div>
  );
}
