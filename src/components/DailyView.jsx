import { useMemo } from 'react';
import ExerciseRow from './ExerciseRow.jsx';
import { CheckIcon } from './Icons.jsx';
import { exercises } from '../data/exercises.js';
import { isDueToday, isToday } from '../utils/tracker.js';

export default function DailyView({ completions, onOpenExercise }) {
  const today = new Date();

  const dateLabel = today.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const { due, notDue } = useMemo(() => {
    const due = [];
    const notDue = [];
    for (const ex of exercises) {
      if (isDueToday(ex, completions)) due.push(ex);
      else notDue.push(ex);
    }
    return { due, notDue };
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
            Due now
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

      {notDue.length > 0 && (
        <>
          <div className="section-label" style={{ marginTop: 28 }}>
            Not due today
            <span className="section-count muted">{notDue.length}</span>
          </div>
          <div className="row-group muted-group">
            {notDue.map((ex) => (
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
