import { useMemo } from 'react';
import ExerciseCard from './ExerciseCard.jsx';
import { exercises } from '../data/exercises.js';
import { isDueToday } from '../utils/tracker.js';

export default function DailyView({ completions, onMarkDone, onUndo }) {
  const today = new Date();
  const dateLabel = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const { due, notDue } = useMemo(() => {
    const due = [];
    const notDue = [];
    for (const ex of exercises) {
      if (isDueToday(ex, completions)) {
        due.push(ex);
      } else {
        notDue.push(ex);
      }
    }
    return { due, notDue };
  }, [completions]);

  const totalDue = due.length;
  const doneToday = notDue.filter((ex) => {
    const id = String(ex.id);
    const history = completions[id] || [];
    const isToday = (iso) => {
      const d = new Date(iso);
      const now = new Date();
      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
      );
    };
    return history.some(isToday);
  }).length;

  const progressPct =
    exercises.length > 0
      ? Math.round((doneToday / exercises.length) * 100)
      : 0;

  return (
    <div className="daily-view">
      <div className="daily-header">
        <div className="date-label">{dateLabel}</div>
        <div className="progress-row">
          <span className="progress-text">
            {doneToday} of {exercises.length} exercises done today
          </span>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {totalDue === 0 ? (
        <div className="all-done">
          <div className="all-done-icon">🐾</div>
          <p>All exercises done for now!</p>
          <p className="all-done-sub">Check back later for Domino's next session.</p>
        </div>
      ) : (
        <>
          <h2 className="section-heading">
            Due Now <span className="count-badge">{totalDue}</span>
          </h2>
          <div className="exercise-list">
            {due.map((ex) => (
              <ExerciseCard
                key={ex.id}
                exercise={ex}
                completions={completions}
                onMarkDone={onMarkDone}
                onUndo={onUndo}
              />
            ))}
          </div>
        </>
      )}

      {notDue.length > 0 && (
        <>
          <h2 className="section-heading completed-heading">
            Completed / Not Due <span className="count-badge muted">{notDue.length}</span>
          </h2>
          <div className="exercise-list muted-list">
            {notDue.map((ex) => (
              <ExerciseCard
                key={ex.id}
                exercise={ex}
                completions={completions}
                onMarkDone={onMarkDone}
                onUndo={onUndo}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
