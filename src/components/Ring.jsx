/** Anello di avanzamento (0–1) con valore e didascalia al centro. */
export default function Ring({ value, label, caption, size = 86, stroke = 'var(--ring)' }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const v = value == null ? 0 : Math.min(1, Math.max(0, value));
  const len = String(label ?? '').length;
  const fontSize = len >= 8 ? 10 : len >= 7 ? 11 : len >= 6 ? 13 : undefined;
  return (

    <div className="ring" style={{ width: size, height: size }} role="img" aria-label={`${label} ${caption}`}>
      <svg viewBox="0 0 86 86" width={size} height={size} aria-hidden="true">
        <circle cx="43" cy="43" r={r} fill="none" stroke="rgba(246,241,232,0.14)" strokeWidth="7" />
        <circle
          cx="43" cy="43" r={r} fill="none" stroke={stroke} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={`${c * v} ${c}`} transform="rotate(-90 43 43)"
          style={{ transition: 'stroke-dasharray 600ms var(--ease-out)' }}
        />
      </svg>
      <div className="ring-text">
        <strong style={fontSize ? { fontSize } : undefined}>{label}</strong>
        <span>{caption}</span>
      </div>
    </div>
  );
}
