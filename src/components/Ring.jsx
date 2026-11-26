/** Anello di avanzamento (0–1) con valore e didascalia al centro. */
export default function Ring({ value, label, caption, size = 88 }) {
  const r = 40;
  const c = 2 * Math.PI * r;
  const v = value == null ? 0 : Math.min(1, Math.max(0, value));
  return (
    <div className="ring" style={{ width: size, height: size }} role="img" aria-label={`${label} ${caption}`}>
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="9" />
        <circle
          cx="50" cy="50" r={r} fill="none" stroke="var(--accent)" strokeWidth="9" strokeLinecap="round"
          strokeDasharray={`${c * v} ${c}`} transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dasharray 600ms var(--ease-out)' }}
        />
      </svg>
      <div className="ring-text">
        <strong>{label}</strong>
        <span>{caption}</span>
      </div>
    </div>
  );
}
