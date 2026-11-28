/** Anello di avanzamento (0–1) con valore e didascalia al centro. */
export default function Ring({ value, label, caption, size, stroke = 'var(--ring)' }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const v = value == null ? 0 : Math.min(1, Math.max(0, value));
  const dim = size ? { width: size, height: size } : undefined;
  return (
    <div className="ring" style={dim} role="img" aria-label={`${label} ${caption}`}>
      <svg viewBox="0 0 86 86" width="100%" height="100%" aria-hidden="true">
        <circle cx="43" cy="43" r={r} fill="none" stroke="rgba(246,241,232,0.14)" strokeWidth="7" />
        <circle
          cx="43" cy="43" r={r} fill="none" stroke={stroke} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={`${c * v} ${c}`} transform="rotate(-90 43 43)"
          style={{ transition: 'stroke-dasharray 600ms var(--ease-out)' }}
        />
      </svg>
      <div className="ring-text">
        <strong data-testid="ring-label">{label}</strong>
        <span data-testid="ring-caption">{caption}</span>
      </div>
    </div>
  );
}
