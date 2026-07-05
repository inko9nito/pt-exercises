import { useEffect, useMemo, useState } from 'react';
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
// Marks a history entry pushed by drilling from Month into a specific week,
// so the popstate handler below can tell "our drill entry got popped" apart
// from any other back navigation (e.g. closing an exercise detail opened
// from the week log, which pushes/pops its own entries on top of ours).
const DRILL_STATE_KEY = 'progressWeekDrill';

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export default function ProgressView({ completions, plans, todayModel, onOpenExercise }) {
  const { dateMap } = todayModel;
  const [view, setView] = useState(VIEW_MONTH);
  const [monthOffset, setMonthOffset] = useState(0);
  const [weekOffset, setWeekOffset] = useState(0);
  // Whether the current week view was reached by drilling into a specific
  // week from Month (a calendar day or a "Total per week" card) rather than
  // by tapping the Week/Month toggle directly. Only the drill path pushes
  // history, so only it gets a back button and native swipe-back.
  const [drilledIn, setDrilledIn] = useState(false);

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

  // Tapping a specific week (a calendar day or a "Total per week" card) drills
  // from Month into that week. `monthOffset` is untouched by the drill — it
  // stays whatever month you were looking at — so returning to Month (via the
  // back button, the toggle, or a swipe) always lands back on the exact month
  // you left, with no separate "return to" bookkeeping needed. A history
  // entry is pushed so the native back gesture works too, mirroring how
  // App.jsx pushes one to open the exercise detail.
  const goToWeek = (targetOffset) => {
    window.history.pushState({ [DRILL_STATE_KEY]: true }, '', window.location.href);
    setWeekOffset(targetOffset);
    setView(VIEW_WEEK);
    setDrilledIn(true);
  };

  // Leaving a drilled-in week (back button, the Month toggle, or a swipe) all
  // funnel through history.back() when a drill entry is pushed, so the actual
  // view change happens in exactly one place — the popstate handler below —
  // instead of three separate call sites that could drift out of sync with
  // the history stack.
  const leaveDrill = () => {
    if (drilledIn) window.history.back();
    else setView(VIEW_MONTH);
  };

  // Drilling into a week (or toggling back to Month) swaps the content in
  // place on the shared page scroll, so without this the week screen opens
  // still scrolled to wherever the month view had been left (issue #81).
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  useEffect(() => {
    const onPopState = (e) => {
      // Only react once the drill entry itself is the one popped — if the
      // current state still carries the marker, something pushed on top of
      // it (e.g. an exercise opened from the week log) was what closed.
      if (drilledIn && !e.state?.[DRILL_STATE_KEY]) {
        setView(VIEW_MONTH);
        setDrilledIn(false);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [drilledIn]);

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
          onClick={leaveDrill}
        >
          Month
        </button>
      </div>

      <div className="period-nav">
        {!isMonth && (
          <button className="back-button" onClick={leaveDrill} aria-label="Back to month">
            <ChevronLeftIcon size={22} />
          </button>
        )}
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
          <WeekPills
            weekOffset={weekOffset}
            onWeekChange={setWeekOffset}
            canGoNext={weekOffset < 0}
            completions={completions}
            plans={plans}
            today={today}
          />

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
