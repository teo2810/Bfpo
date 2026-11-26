import { useMemo, useState } from 'react';
import { quoteBond, formatEUR, nominaleEUR } from '../lib/quote.js';

export function chartRows(bonds, now = new Date()) {
  return bonds.map((b) => {
    const nominale = nominaleEUR(b);
    const stimaOggi = quoteBond(b, now).valore;
    const interessi = Math.max(0, stimaOggi - nominale);
    return { bond: b, nominale, interessi, totale: nominale + interessi };
  });
}

export default function Charts({ bonds, portfolios }) {
  const [filterId, setFilterId] = useState('all');

  const rows = useMemo(() => {
    const filtered = filterId === 'all' ? bonds : bonds.filter((b) => b.portafoglioId === filterId);
    return chartRows(filtered).sort((a, b) => b.totale - a.totale);
  }, [bonds, filterId]);

  const maxTotale = Math.max(1, ...rows.map((r) => r.totale));
  const totaleCapitale = rows.reduce((s, r) => s + r.nominale, 0);
  const totaleInteressi = rows.reduce((s, r) => s + r.interessi, 0);
  const tot = totaleCapitale + totaleInteressi;
  
  return (
    <div className="screen screen-enter">
      <p className="eyebrow">Cassetto</p>
      <h1 className="title">Capitale vs interessi</h1>
      <p className="subtitle">Composizione stimata del valore di ciascun buono oggi.</p>

      <div className="field" style={{ maxWidth: 360 }}>
        <label htmlFor="chart-filter">Portafoglio</label>
        <select id="chart-filter" value={filterId} onChange={(e) => setFilterId(e.target.value)}>
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
        <div className="charts-grid">
          <div className="card stat-hero">
            <p className="eyebrow">Valore stimato</p>
            <p className="value" data-testid="chart-totale">{formatEUR(tot)}</p>
            <div className="split-bar" aria-hidden="true">
              <span className="cap" style={{ flex: Math.max(totaleCapitale, 0.0001) }} />
              <span className="int" style={{ flex: Math.max(totaleInteressi, 0.0001) }} />
            </div>
            <div className="legend">
              <span><span className="dot cap" />Capitale · <strong data-testid="chart-capitale">{formatEUR(totaleCapitale)}</strong></span>
              <span><span className="dot int" />Interessi (stima) · <strong data-testid="chart-interessi">{formatEUR(totaleInteressi)}</strong></span>
            </div>
          </div>

          <div className="card" role="img" aria-label="Capitale e interessi per buono">
            <p className="eyebrow">Per buono</p>
            <div className="bars">
              {rows.map((r) => (
                <div key={r.bond.id} className="bar-row">
                  <div className="bar-head">
                    <span className="bar-name">{(r.bond.serie || 'Buono') + ' · n. ' + r.bond.numero}</span>
                    <span className="bar-val">{formatEUR(r.totale)}</span>
                  </div>
                  <div className="bar-track">
                    <span className="seg cap" style={{ width: `${(r.nominale / maxTotale) * 100}%` }} title={`Capitale ${formatEUR(r.nominale)}`} />
                    <span className="seg int" style={{ width: `${(r.interessi / maxTotale) * 100}%` }} title={`Interessi ${formatEUR(r.interessi)}`} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <p className="disclaimer">
        I valori sono stime calcolate localmente a partire dal valore a scadenza che hai indicato
        (capitalizzazione composta a tasso medio costante). Senza valore a scadenza gli interessi non
        sono stimabili. Per l'importo esatto fai sempre riferimento allo sportello postale.
      </p>
    </div>
  );
}
