import { useMemo, useState } from 'react';
import { quoteBond, formatEUR } from '../lib/quote.js';

export default function Charts({ bonds, portfolios }) {
  const [filterId, setFilterId] = useState('all');
  const now = new Date();

  const filtered = filterId === 'all' ? bonds : bonds.filter((b) => b.portafoglioId === filterId);

  const rows = useMemo(
    () =>
      filtered.map((b) => {
        const nominale = Number(b.nominale) || 0;
        const stimaOggi = quoteBond(b, now).valore;
        const interessi = Math.max(0, stimaOggi - nominale);
        return { bond: b, nominale, interessi, totale: nominale + interessi };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered]
  );

  const maxTotale = Math.max(1, ...rows.map((r) => r.totale));
  const totaleCapitale = rows.reduce((s, r) => s + r.nominale, 0);
  const totaleInteressi = rows.reduce((s, r) => s + r.interessi, 0);

  const chartW = 320;
  const barH = 26;
  const gap = 14;
  const chartH = rows.length * (barH + gap) + gap || 60;

  return (
    <div className="screen screen-enter">
      <p className="eyebrow">Cassetto</p>
      <h1 className="title">Capitale vs interessi</h1>
      <p className="subtitle">Composizione stimata del valore di ciascun buono. Se manca una curva ufficiale, gli interessi sono una stima grezza.</p>

      <div className="field">
        <label>Portafoglio</label>
        <select value={filterId} onChange={(e) => setFilterId(e.target.value)}>
          <option value="all">Tutti</option>
          {portfolios.map((p) => (
            <option key={p.id} value={p.id}>{p.nome}</option>
          ))}
        </select>
      </div>

      {rows.length === 0 ? (
        <div className="empty">
          <div className="icon">📊</div>
          <p>Nessun dato da mostrare.</p>
        </div>
      ) : (
        <div className="card chart-wrap">
          <svg viewBox={`0 0 ${chartW} ${chartH}`} width="100%" role="img" aria-label="Capitale vs interessi per buono">
            {rows.map((r, i) => {
              const y = gap + i * (barH + gap);
              const capW = (r.nominale / maxTotale) * (chartW - 10);
              const intW = (r.interessi / maxTotale) * (chartW - 10);
              return (
                <g key={r.bond.id}>
                  <rect x="0" y={y} width={capW} height={barH} rx="7" fill="var(--cyan)" opacity="0.85" />
                  <rect x={capW} y={y} width={intW} height={barH} rx="7" fill="var(--mint)" opacity="0.85" />
                  <text x="4" y={y - 4} fontSize="9" fill="var(--text-2)">
                    {(r.bond.serie || 'Buono') + ' · n.' + r.bond.numero}
                  </text>
                </g>
              );
            })}
          </svg>
          <div className="legend">
            <span><span className="dot" style={{ background: 'var(--cyan)' }} />Capitale · {formatEUR(totaleCapitale)}</span>
            <span><span className="dot" style={{ background: 'var(--mint)' }} />Interessi (stima) · {formatEUR(totaleInteressi)}</span>
          </div>
        </div>
      )}

      <p className="disclaimer">
        I valori sono stime calcolate localmente, senza curve di rendimento ufficiali per tutte le
        serie. Per l'importo esatto fai sempre riferimento allo sportello postale.
      </p>
    </div>
  );
}
