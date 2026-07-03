export default function ProgressRing({ value, max, bonus = 0, size = 148, strokeWidth = 12, label = 'Done today' }) {
  // A rest day (nothing prescribed) reads as complete rather than as an
  // empty/failed ring; in this dataset a daily exercise means it never
  // actually happens, but the guard keeps 0/0 from rendering as NaN.
  const isRestDay = max === 0;
  const pct = isRestDay ? 1 : Math.min(value / max, 1);
  // The flourish is earned strictly by finishing the plan — bonus work can
  // amplify it (the +N + glow) but can never trigger it on its own.
  const isComplete = isRestDay || value >= max;
  const angle = pct * 360;

  return (
    <div className={`progress-ring-wrap ${isComplete ? 'is-complete' : ''}`} style={{ width: size, height: size }}>
      <div
        className="progress-ring-track"
        style={{
          width: size,
          height: size,
          background: `conic-gradient(var(--success) ${angle}deg, var(--border) 0deg)`,
        }}
      >
        <div className="progress-ring-hole" style={{ width: size - strokeWidth * 2, height: size - strokeWidth * 2 }} />
      </div>
      <div className="progress-ring-value">
        {isRestDay ? (
          <>
            <span className="progress-ring-count">Rest</span>
            <span className="progress-ring-label">Nothing due today</span>
          </>
        ) : (
          <>
            <span className="progress-ring-count">{value}/{max}</span>
            <span className="progress-ring-label">{label}</span>
          </>
        )}
        {bonus > 0 && <span className="progress-ring-bonus">+{bonus} extra</span>}
      </div>
    </div>
  );
}
