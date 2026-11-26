import { useMemo, useState } from 'react';
import { quoteBond, formatEUR, daysUntil, formatDate, maturazione } from '../lib/quote.js';
import { BackIcon, BondsIcon } from '../components/icons.jsx';
import Ring from '../components/Ring.jsx';

export function urgencyOf(bond, now = new Date()) {
  const dScad = daysUntil(bond.dataScadenza, now);
  const dPres = daysUntil(bond.dataPrescrizione, now);
  const gg = (n) => (n === 1 ? '1 giorno' : `${n} gg`);

  if (dPres != null && dPres <= 90) {
    return {
      level: 'danger',
      label: dPres < 0 ? `Prescritto da ${gg(-dPres)}` : dPres === 0 ? 'Si prescrive oggi' : `Prescrizione tra ${gg(dPres)}`,
      criticalDays: dPres,
    };
  }
  if (dScad != null && dScad <= 90) {
    return {
      level: 'warn',
      label: dScad < 0 ? `Scaduto da ${gg(-dScad)}` : dScad === 0 ? 'Scade oggi' : `Scadenza tra ${gg(dScad)}`,
      criticalDays: dScad,
    };
  }
  // Prossima data rilevante ancora futura (la scadenza passata non conta più).
  const future = [dScad, dPres].filter((d) => d != null && d >= 0);
  return { level: 'ok', label: null, criticalDays: future.length ? Math.min(...future) : Infinity };
}

export function byCriticalDays(a, b) {
  const x = a.urgency.criticalDays;
  const y = b.urgency.criticalDays;
  if (x === y) return String(a.bond.numero || '').localeCompare(String(b.bond.numero || ''));
  if (x === Infinity) return 1;
  if (y === Infinity) return -1;
  return x - y;
}

const pct = (v) => (v == null ? null : Math.round(v * 100));

function BondRow({ bond, quote, urgency, portfolio, mat, onOpen }) {
  const color = portfolio ? `var(--${portfolio.colore})` : 'var(--brand)';
  const p = pct(mat);
  return (
    <button className="row bond-row" onClick={() => onOpen(bond.id)} style={{ ['--row-accent']: color }}>
      <span className="tile" aria-hidden="true"><BondsIcon size={20} /></span>
      <span className="left">
        <span className="name">{bond.serie || 'Buono'} · n. {bond.numero}</span>
        <span className="meta">
          {bond.intestatari?.length ? bond.intestatari.join(' e ') : portfolio?.nome || 'Senza portafoglio'}
          {bond.dataScadenza ? ` · scad. ${formatDate(bond.dataScadenza)}` : ''}
        </span>
        {urgency.label && <span className={`pill ${urgency.level}`}>{urgency.label}</span>}
      </span>
      <span className="right">
        <span className="amount">{formatEUR(quote.valore)}</span>
        {p != null && (
          <span className="progress" title="Maturazione stimata">
            <span className="bar"><span style={{ width: `${p}%` }} /></span>
            <span className="pc">{p}%</span>
          </span>
        )}
      </span>
    </button>
  );
}

export default function Home({
  bonds,
  portfolios,
  lastOpenedPrevious,
  onOpenBond,
  onGoAdd,
  demoActive,
  onStartFresh,
  titleOverride,
  subtitleOverride,
  onBack,
}) {
  const [filter, setFilter] = useState('all');
  const enriched = useMemo(() => {
    const now = new Date();
    return bonds.map((b) => ({ bond: b, quote: quoteBond(b, now), urgency: urgencyOf(b, now), mat: maturazione(b, now) }));
  }, [bonds]);

  const totale = enriched.reduce((sum, e) => sum + e.quote.valore, 0);
  const capitale = enriched.reduce((sum, e) => sum + (Number(e.bond.nominale) || 0), 0);
  const interessi = totale - capitale;
  const urgentiCount = enriched.filter((e) => e.urgency.level !== 'ok').length;
  const sorted = [...enriched].sort(byCriticalDays);

  // Maturazione complessiva: interessi maturati / interessi a scadenza (solo buoni stimabili).
  const matTot = (() => {
    let num = 0;
    let den = 0;
    for (const e of enriched) {
      const vs = Number(e.bond.valoreScadenza);
      const n = Number(e.bond.nominale) || 0;
      if (vs > n) {
        num += Math.max(0, e.quote.valore - n);
        den += vs - n;
      }
    }
    return den > 0 ? num / den : null;
  })();

  const usedPortfolios = portfolios.filter((p) => bonds.some((b) => b.portafoglioId === p.id));
  const showFilters = !onBack && bonds.length > 0;
  const visible = sorted.filter((e) => {
    if (filter === 'all') return true;
    if (filter === 'ritirare') return e.urgency.level !== 'ok';
    return e.bond.portafoglioId === filter;
  });

  const notVerified =
    lastOpenedPrevious && (Date.now() - new Date(lastOpenedPrevious).getTime()) / 86400000 > 90;
  const portfolioOf = (id) => portfolios.find((p) => p.id === id);

  return (
    <div className="screen screen-enter">
      {demoActive && (
        <div className="banner info">
          <span>Stai vedendo dati dimostrativi.</span>
          <button className="link-btn" onClick={onStartFresh}>Inizia con i tuoi</button>
        </div>
      )}

      {notVerified && (
        <div className="banner">
          <strong>Cassetto non verificato.</strong> Non apri l'app da più di 90 giorni: controlla che
          scadenze e prescrizioni siano ancora corrette confrontando i titoli cartacei.
        </div>
      )}

      <header className="stat-hero hero-main">
        <div className="hero-top">
          <div style={{ minWidth: 0 }}>
            {onBack ? (
              <>
                <button className="icon-btn on-brand" onClick={onBack} aria-label="Indietro"><BackIcon /></button>
                <h1 className="title hero-title">{titleOverride || 'Portafoglio'}</h1>
                <p className="hero-sub">{subtitleOverride || 'Buoni di questo portafoglio.'}</p>
              </>
            ) : (
              <p className="hero-hello">Ciao,</p>
            )}
            <p className="value is-stima" data-testid="totale">{formatEUR(totale)}</p>
            <p className="hero-sub">totale stimato oggi</p>
          </div>
          <Ring value={matTot} label={matTot == null ? '—' : `${pct(matTot)}%`} caption="MATURATO" />
        </div>
        <div className="split-bar" aria-hidden="true">
          <span className="cap" style={{ flex: Math.max(capitale, 0.0001) }} />
          <span className="int" style={{ flex: Math.max(interessi, 0.0001) }} />
        </div>
        <div className="legend">
          <span><span className="dot cap" />Capitale · <strong>{formatEUR(capitale)}</strong></span>
          <span><span className="dot int" />Interessi (stima) · <strong>{formatEUR(interessi)}</strong></span>
          <span>{bonds.length === 1 ? '1 buono' : `${bonds.length} buoni`} · {urgentiCount} da controllare</span>
        </div>
      </header>

      {bonds.length === 0 ? (
        <div className="empty">
          <div className="icon">🗂️</div>
          <p>Nessun buono ancora indicizzato.</p>
          <button className="btn primary" style={{ marginTop: 14, width: 'auto', padding: '0 24px' }} onClick={onGoAdd}>
            Aggiungi il primo buono
          </button>
        </div>
      ) : (
        <>
          {showFilters && (
            <div className="filters" role="tablist" aria-label="Filtra i buoni">
              {[
                { key: 'all', label: 'Tutti' },
                ...usedPortfolios.map((p) => ({ key: p.id, label: p.nome })),
                { key: 'ritirare', label: 'Da ritirare' },
              ].map((f) => (
                <button key={f.key} role="tab" aria-selected={filter === f.key} className={`chip${filter === f.key ? ' on' : ''}`} onClick={() => setFilter(f.key)}>
                  {f.label}
                </button>
              ))}
            </div>
          )}
          <div className="list bond-list">
            {visible.map((e) => (
              <BondRow key={e.bond.id} {...e} portfolio={portfolioOf(e.bond.portafoglioId)} onOpen={onOpenBond} />
            ))}
            {visible.length === 0 && <div className="empty" style={{ gridColumn: '1 / -1' }}><p>Nessun buono in questo filtro.</p></div>}
          </div>
          {onBack && (
            <button className="btn ghost block" style={{ marginTop: 14 }} onClick={onGoAdd}>+ Aggiungi buono qui</button>
          )}
        </>
      )}
    </div>
  );
}
