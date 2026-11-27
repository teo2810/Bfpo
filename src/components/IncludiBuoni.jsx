/** Elenco di buoni con checkbox, usato dopo la creazione di un portafoglio e nello spostamento massivo. */
export default function IncludiBuoni({
  bonds,
  selected,
  onToggle,
  onConfirm,
  onSkip,
  title = 'Buoni da includere',
  skipLabel = 'Salta',
  confirmLabel,
}) {
  const n = selected.size;
  return (
    <div className="card" data-testid="includi-buoni">
      <p className="eyebrow">{title}</p>
      <p className="disclaimer" style={{ marginTop: 0 }}>Scegli quali buoni mettere in questo portafoglio.</p>
      <div className="includi-list">
        {bonds.map((b) => (
          <label key={b.id} className="includi-row">
            <input
              type="checkbox"
              checked={selected.has(b.id)}
              onChange={() => onToggle(b.id)}
              data-testid={`includi-${b.id}`}
            />
            <span>{b.numero ? `${b.serie || 'Buono'} · n. ${b.numero}` : (b.serie || 'Buono')}</span>
          </label>
        ))}
        {bonds.length === 0 && <p className="disclaimer">Nessun buono da mostrare.</p>}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
        <button type="button" className="btn ghost" style={{ flex: 1 }} onClick={onSkip}>{skipLabel}</button>
        <button type="button" className="btn primary" style={{ flex: 1 }} onClick={onConfirm} data-testid="includi-conferma">
          {confirmLabel || (n ? `Includi ${n} ${n === 1 ? 'buono' : 'buoni'}` : 'Crea senza buoni')}
        </button>
      </div>
    </div>
  );
}
