import { useMemo, useState } from 'react';
import ExerciseRow from './ExerciseRow.jsx';
import WeekStrip from './WeekStrip.jsx';
import DayLogList from './DayLogList.jsx';
import AddExerciseSheet from './AddExerciseSheet.jsx';
import { CheckIcon, PlusIcon } from './Icons.jsx';
import { exercises } from '../data/exercises.js';
import { formatDateLong } from '../utils/format.js';
import { getDaysOverdue, isScheduledToday, dateKey, groupDayCards } from '../utils/tracker.js';

export default function DailyView({ completions, todayModel, onOpenExercise, onLogForDate }) {
  const {
    dateMap,
    due,
    laterToday,
    optional,
    completedToday,
    notScheduledToday,
    planTotal,
    planDone,
    bonusDone,
  } = todayModel;

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

  // Group that day's sessions by exercise so each renders as a single card
  // (like today's list) carrying the time(s) it was done, rather than one
  // text line per session.
  const selectedDayCards = useMemo(() => {
    if (isViewingToday) return null;
    return groupDayCards(dateMap, selectedDate);
  }, [isViewingToday, dateMap, selectedDate]);

  const selectedDateObj = useMemo(() => new Date(`${selectedDate}T12:00:00`), [selectedDate]);

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
          <DayLogList
            cards={selectedDayCards}
            date={selectedDateObj}
            completions={completions}
            onOpenExercise={onOpenExercise}
            emptyMessage="Nothing logged this day."
          />

          <button className="add-exercise-btn" onClick={() => setShowAddSheet(true)}>
            <PlusIcon size={16} />
            Log an exercise for this day
          </button>
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

          {(due.length > 0 || optional.length > 0) && (
            <>
              <div className="section-label">
                To do
                <span className="section-count">{due.length + optional.length}</span>
              </div>
              <div className="row-group">
                {due.map((ex) => (
                  <ExerciseRow
                    key={ex.id}
                    exercise={ex}
                    completions={completions}
                    onOpen={onOpenExercise}
                    overdueDays={getDaysOverdue(ex, completions)}
                  />
                ))}
                {/* Optional exercises share the To do list, listed after the
                    required ones and marked with an "Optional" tag, rather
                    than living in a separate section. */}
                {optional.map((ex) => (
                  <ExerciseRow
                    key={ex.id}
                    exercise={ex}
                    completions={completions}
                    onOpen={onOpenExercise}
                    optional
                  />
                ))}
              </div>
            </>
          )}

          {due.length === 0 && laterToday.length === 0 && optional.length === 0 && (
            <div className="all-done-state">
              <div className="all-done-icon">
                <CheckIcon size={26} />
              </div>
              <p className="all-done-title">All caught up</p>
              <p className="all-done-sub">Check back later for Domino's next session.</p>
            </div>
          )}

          {laterToday.length > 0 && (
            <>
              <div className="section-label" style={{ marginTop: 28 }}>
                Later today
                <span className="section-count">{laterToday.length}</span>
              </div>
              <div className="row-group">
                {laterToday.map((ex) => (
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
                    extra={!isScheduledToday(ex, completions)}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {showAddSheet && isViewingToday && (
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

      {showAddSheet && !isViewingToday && (
        // Past day: tapping an exercise logs it *for that day* (retroactively)
        // rather than opening it — you're recording something you forgot, not
        // doing it now. Any exercise can be added, so the full list is offered.
        <AddExerciseSheet
          title={`Log for ${formatDateLong(selectedDate)}`}
          exercises={exercises}
          completions={completions}
          onOpenExercise={(ex) => {
            setShowAddSheet(false);
            onLogForDate(ex.id, selectedDateObj);
          }}
          onClose={() => setShowAddSheet(false)}
        />
      )}
    </div>
  );
}
