export default function ProgressRing({ value, max, size = 148, strokeWidth = 12, label = 'Done today' }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const offset = circumference * (1 - pct);
  const center = size / 2;

  return (
    <div className="progress-ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          style={{ stroke: 'var(--border)' }}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          style={{ stroke: 'var(--success)', transition: 'stroke-dashoffset .5s ease' }}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
        />
      </svg>
      <div className="progress-ring-value">
        <span className="progress-ring-count">{value}/{max}</span>
        <span className="progress-ring-label">{label}</span>
      </div>
    </div>
  );
}
