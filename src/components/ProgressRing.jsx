export default function ProgressRing({ value, max, size = 148, strokeWidth = 12, label = 'Done today' }) {
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const angle = pct * 360;

  return (
    <div className="progress-ring-wrap" style={{ width: size, height: size }}>
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
        <span className="progress-ring-count">{value}/{max}</span>
        <span className="progress-ring-label">{label}</span>
      </div>
    </div>
  );
}
