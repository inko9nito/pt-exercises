import { useMemo, useState } from 'react';
import MonthCalendar from './MonthCalendar.jsx';
import WeekPills from './WeekPills.jsx';
import DayLogList from './DayLogList.jsx';
import { ChevronLeftIcon, ChevronRightIcon, CalendarIcon } from './Icons.jsx';
import { exercises } from '../data/exercises.js';
import { dateKey, getDayEntries } from '../utils/tracker.js';
import {
  monthInfo,
  weekDates,
  weekLabel,
  weekOffsetOf,
  rangeStats,
  weeksOverlappingMonth,
} from '../utils/progressStats.js';

const VIEW_WEEK = 'week';
const VIEW_MONTH = 'month';

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export default function ProgressView({ completions, plans, todayModel, onOpenExercise }) {
  const { dateMap } = todayModel;
  const [view, setView] = useState(VIEW_MONTH);
  const [monthOffset, setMonthOffset] = useState(0);
  const [weekOffset, setWeekOffset] = useState(0);

  const today = new Date();

  // ---- Month mode -------------------------------------------------------
  const month = useMemo(() => monthInfo(monthOffset), [monthOffset]);
  const monthStats = useMemo(
    () => rangeStats(dateMap, month.days, today),
    // `today` is stable within a render; month.days already depends on offset.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dateMap, month]
  );
  const weekCards = useMemo(
    () =>
      weeksOverlappingMonth(month.year, month.month)
        .filter((w) => !w.isFuture)
        .map((w) => ({
          key: dateKey(w.days[0]),
          label: w.isCurrent ? 'This week' : weekLabel(w.days),
          weekOffset: w.weekOffset,
          ...rangeStats(dateMap, w.days, today),
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dateMap, month]
  );

  // ---- Week mode --------------------------------------------------------
  const week = useMemo(() => weekDates(weekOffset), [weekOffset]);
  const weekStats = useMemo(
    () => rangeStats(dateMap, week, today),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dateMap, week]
  );
  // Each day of the week that actually had a session, most-recent-first, with
  // its completed exercises — a "what got done" log (missed rows filtered out,
  // unlike the plan-vs-actual day detail elsewhere).
  const weekLog = useMemo(() => {
    const todayKey = dateKey(today);
    return week
      .filter((d) => dateKey(d) <= todayKey)
      .map((date) => ({
        date,
        entries: getDayEntries(exercises, completions, plans, date).filter((e) => e.done),
      }))
      .filter((d) => d.entries.length > 0)
      .reverse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completions, plans, week]);

  const isMonth = view === VIEW_MONTH;
  const offset = isMonth ? monthOffset : weekOffset;
  const setOffset = isMonth ? setMonthOffset : setWeekOffset;
  const periodLabel = isMonth ? month.label : weekLabel(week);
  const stats = isMonth ? monthStats : weekStats;
  const denominator = isMonth ? month.daysInMonth : 7;

  const goToWeek = (targetOffset) => {
    setWeekOffset(targetOffset);
    setView(VIEW_WEEK);
  };

  return (
    <div className="progress-view">
      <div className="view-toggle" role="tablist" aria-label="Progress period">
        <button
          role="tab"
          aria-selected={view === VIEW_WEEK}
          className={`view-toggle-btn ${view === VIEW_WEEK ? 'is-active' : ''}`}
          onClick={() => setView(VIEW_WEEK)}
        >
          Week
        </button>
        <button
          role="tab"
          aria-selected={view === VIEW_MONTH}
          className={`view-toggle-btn ${view === VIEW_MONTH ? 'is-active' : ''}`}
          onClick={() => setView(VIEW_MONTH)}
        >
          Month
        </button>
      </div>

      <div className="period-nav">
        <span className="period-label">{periodLabel}</span>
        <div className="period-controls">
          <button className="period-btn" onClick={() => setOffset(offset - 1)} aria-label="Previous">
            <ChevronLeftIcon size={18} />
          </button>
          <button
            className="period-btn"
            onClick={() => setOffset(offset + 1)}
            disabled={offset >= 0}
            aria-label="Next"
          >
            <ChevronRightIcon size={18} />
          </button>
          <button
            className="period-btn"
            onClick={() => setOffset(0)}
            disabled={offset === 0}
            aria-label={isMonth ? 'This month' : 'This week'}
          >
            <CalendarIcon size={16} />
          </button>
        </div>
      </div>

      <div className="period-headline">
        <p className="period-stat">
          <span className="period-stat-num">{stats.exerciseDays}</span> of{' '}
          <span className="period-stat-num">{denominator}</span> exercise days
        </p>
        <p className="period-stat-sub">
          Domino exercised a total of {plural(stats.totalSessions, 'time')}
        </p>
      </div>

      {isMonth ? (
        <>
          <MonthCalendar
            year={month.year}
            month={month.month}
            dateMap={dateMap}
            selectedDate={null}
            onSelectDate={(key) => key && goToWeek(weekOffsetOf(new Date(`${key}T12:00:00`)))}
          />

          <div className="week-summary">
            <div className="week-summary-head">
              <span className="week-summary-title">{month.label}</span>
              <span className="week-summary-sub">Total per week</span>
            </div>
            {weekCards.map((card) => (
              <button
                key={card.key}
                className="week-summary-card"
                onClick={() => goToWeek(card.weekOffset)}
              >
                <span className="week-summary-main">
                  <span className="week-summary-range">{card.label}</span>
                  <span className="week-summary-types">
                    {card.exerciseTypes > 0 ? plural(card.exerciseTypes, 'exercise') : 'No activity'}
                  </span>
                </span>
                <span className="week-summary-count">{card.exerciseDays}</span>
                <ChevronRightIcon size={18} />
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <WeekPills days={week} dateMap={dateMap} today={today} />

          <div className="week-log">
            {weekLog.length === 0 ? (
              <p className="day-detail-empty">No sessions logged this week.</p>
            ) : (
              weekLog.map(({ date, entries }) => (
                <div key={dateKey(date)} className="week-log-day">
                  <p className="week-log-date">
                    {date.toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                  <DayLogList
                    entries={entries}
                    date={date}
                    onOpenExercise={onOpenExercise}
                    emptyMessage=""
                  />
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
