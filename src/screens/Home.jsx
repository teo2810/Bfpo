import { useEffect, useMemo, useState } from 'react';
import { quoteBond, formatEUR, formatLire, formatDate, formatPct, daysUntil, maturazione, nominaleEUR, valoreScadenzaEUR } from '../lib/quote.js';
import { isRitirato, riepilogoRitirati } from '../lib/ritirati.js';
import { BackIcon } from '../components/icons.jsx';
import { chromeOf } from '../components/icons.jsx';
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

const LEAF = (
  <svg className="hero-leaf" viewBox="0 0 160 160" fill="currentColor" aria-hidden="true">
    <path d="M128 18c-38 8-78 46-74 108 28-18 62-22 86-48 14-16 18-38 10-54-6-10-14-12-22-6Z" />
    <path d="M62 118c22-28 52-48 76-58" fill="none" stroke="#06343c" strokeWidth="3" strokeLinecap="round" opacity="0.35" />
  </svg>
);
const LEAF2 = (
  <svg className="hero-leaf-2" viewBox="0 0 120 120" fill="currentColor" aria-hidden="true">
    <path d="M96 16c-30 10-58 40-54 86 22-12 48-16 66-38 10-12 12-28 6-40-4-8-10-10-18-8Z" />
  </svg>
);

function BondRow({ bond, quote, urgency, portfolio, mat, onOpen, ritirato = false }) {
  const { tone, Icon } = chromeOf(bond, portfolio);
  const p = pct(mat);
  const who = bond.intestatari?.length ? bond.intestatari.join(' e ') : portfolio?.nome || 'Senza portafoglio';
  return (
    <button
      className="row bond-row"
      onClick={() => onOpen(bond.id)}
      style={{
        ['--row-accent']: `var(--${tone})`,
        ['--row-bg']: `var(--${tone}-bg)`,
        ['--row-ink']: `var(--${tone}-ink, var(--${tone}))`,
      }}
    >
      <span className="bond-top">
        <span className="tile" aria-hidden="true"><Icon size={20} /></span>
        <span className="left">
          <span className="name">{bond.numero ? `${bond.serie || 'Buono'} · n. ${bond.numero}` : (bond.serie || 'Buono')}</span>
          <span className="meta">{who}</span>
        </span>
        <span className="amount-col">
          {ritirato ? (
            <>
              <span className="amount" data-testid="importo-incassato">{formatEUR(bond.importoIncassato)}</span>
              <span className="amount-sub" data-testid="data-rimborso">{bond.dataRimborso ? formatDate(bond.dataRimborso) : 'Ritirato'}</span>
            </>
          ) : (
            <>
              <span className="amount">{formatEUR(quote.valore)}</span>
              {quote.valuta === 'ITL' && <span className="amount-sub" data-testid="importo-lire">da {formatLire(bond.nominale)}</span>}
            </>
          )}
        </span>
      </span>
      {!ritirato && p != null && (
        <span className="mat" title="Maturazione stimata">
          <span className="mat-track"><i style={{ width: `${p}%` }} /></span>
          <span className="mat-pct pc">{p}%</span>
        </span>
      )}
      {!ritirato && urgency.label && <span className={`pill ${urgency.level}`}>{urgency.label}</span>}
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
  const vistaRitirati = filter === 'ritirati';
  const enriched = useMemo(() => {
    const now = new Date();
    return bonds.filter((b) => !isRitirato(b)).map((b) => ({ bond: b, quote: quoteBond(b, now), urgency: urgencyOf(b, now), mat: maturazione(b, now) }));
  }, [bonds]);
  const enrichedRitirati = useMemo(() => {
    const now = new Date();
    return bonds.filter(isRitirato)
      .map((b) => ({ bond: b, quote: quoteBond(b, now), urgency: { label: null, level: 'ok' }, mat: null }))
      .sort((a, b) => String(b.bond.dataRimborso || '').localeCompare(String(a.bond.dataRimborso || '')));
  }, [bonds]);
  const recap = useMemo(() => riepilogoRitirati(bonds), [bonds]);

  const totale = enriched.reduce((sum, e) => sum + e.quote.valore, 0);
  const capitale = enriched.reduce((sum, e) => sum + nominaleEUR(e.bond), 0);
  const interessi = totale - capitale;
  const sorted = [...enriched].sort(byCriticalDays);

  // Maturazione complessiva: interessi maturati / interessi a scadenza (solo buoni stimabili).
  const matTot = (() => {
    let num = 0;
    let den = 0;
    for (const e of enriched) {
      const vs = valoreScadenzaEUR(e.bond) ?? NaN;
      const n = nominaleEUR(e.bond);
      if (vs > n) {
        num += Math.max(0, e.quote.valore - n);
        den += vs - n;
      }
    }
    return den > 0 ? num / den : null;
  })();

  const showFilters = !onBack && bonds.length > 0;
  useEffect(() => {
    if (filter !== 'all' && filter !== 'ritirare' && filter !== 'ritirati' && !portfolios.some((p) => p.id === filter)) {
      setFilter('all');
    }
  }, [filter, portfolios]);
  const visible = vistaRitirati ? enrichedRitirati : sorted.filter((e) => {
    if (filter === 'all') return true;
    if (filter === 'ritirare') return e.urgency.level !== 'ok';
    return e.bond.portafoglioId === filter;
  });

  const notVerified =
    lastOpenedPrevious && (Date.now() - new Date(lastOpenedPrevious).getTime()) / 86400000 > 90;
  const portfolioOf = (id) => portfolios.find((p) => p.id === id);

  return (
    <div className="screen screen-enter screen-pin">
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

      <header className="stat-hero hero-main" data-testid="home-hero">
        {LEAF}{LEAF2}
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
            {vistaRitirati ? (
              <>
                <p className="value is-stima" data-testid="totale-incassato">{formatEUR(recap.incassato)}</p>
                <p className="hero-sub">totale incassato</p>
              </>
            ) : (
              <>
                <p className="value is-stima" data-testid="totale">{formatEUR(totale)}</p>
                <p className="hero-sub">totale stimato</p>
              </>
            )}
          </div>
          {vistaRitirati ? (
            recap.rendimento != null && (
              <Ring
                value={Math.min(1, Math.abs(recap.rendimento))}
                label={formatPct(recap.rendimento)}
                caption="rendimento"
                stroke={recap.differenza < 0 ? 'var(--coral)' : 'var(--ring)'}
              />
            )
          ) : (
            <Ring value={matTot} label={matTot == null ? '—' : `${pct(matTot)}%`} caption="maturato" />
          )}
        </div>
        <div className="split-bar" aria-hidden="true">
          {vistaRitirati ? (
            recap.differenza >= 0 ? (
              <>
                <span className="cap" style={{ flex: Math.max(recap.nominale, 0.0001) }} />
                <span className="int" style={{ flex: Math.max(recap.differenza, 0.0001) }} />
              </>
            ) : (
              <>
                <span className="cap" style={{ flex: Math.max(recap.incassato, 0.0001) }} />
                <span className="int neg" style={{ flex: Math.max(-recap.differenza, 0.0001) }} />
              </>
            )
          ) : (
            <>
              <span className="cap" style={{ flex: Math.max(capitale, 0.0001) }} />
              <span className="int" style={{ flex: Math.max(interessi, 0.0001) }} />
            </>
          )}
        </div>
        <div className="hero-legend">
          {vistaRitirati ? (
            <>
              <div>
                <div className="leg-name"><span className="dot cap" />Nominale</div>
                <div className="leg-val">{formatEUR(recap.nominale)}</div>
              </div>
              <div>
                <div className="leg-name"><span className={`dot int${recap.differenza < 0 ? ' neg' : ''}`} />Rendimento</div>
                <div className="leg-val">{formatEUR(recap.differenza)}{recap.rendimento != null ? ` · ${formatPct(recap.rendimento)}` : ''}</div>
              </div>
            </>
          ) : (
            <>
              <div>
                <div className="leg-name"><span className="dot cap" />Capitale</div>
                <div className="leg-val">{formatEUR(capitale)}</div>
              </div>
              <div>
                <div className="leg-name"><span className="dot int" />Interessi</div>
                <div className="leg-val">{formatEUR(interessi)}</div>
              </div>
            </>
          )}
        </div>
      </header>

      {bonds.length === 0 ? (
        <div className="body-pad screen-col">
          <div className="screen-scroll" data-testid="list-scroll"><div className="empty">
          <div className="icon">🗂️</div>
          <p>Nessun buono ancora indicizzato.</p>
          <button className="btn primary" style={{ marginTop: 14, width: 'auto', padding: '0 24px' }} onClick={onGoAdd}>
            Aggiungi il primo buono
          </button>
        </div></div>
        </div>
      ) : (
        <div className="body-pad screen-col">
          {showFilters && (
            <div className="pin-tools">
            <div className="filters" role="tablist" aria-label="Filtra i buoni" data-testid="filtri">
              {[
                { key: 'all', label: 'Tutti' },
                ...portfolios.map((p) => ({ key: p.id, label: p.nome })),
                { key: 'ritirare', label: 'Da ritirare' },
                { key: 'ritirati', label: 'Ritirati' },
              ].map((f) => (
                <button
                  key={f.key}
                  role="tab"
                  aria-selected={filter === f.key}
                  title={f.label}
                  data-testid={`filtro-${f.key}`}
                  className={`chip${filter === f.key ? ' on' : ''}`}
                  onClick={() => setFilter(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            </div>
          )}
          <div className="screen-scroll" data-testid="list-scroll">
          {vistaRitirati && (
            <div className="card ritirati-recap" data-testid="ritirati-recap">
              <p className="eyebrow">Confronto con il nominale</p>
              <div className="recap-row"><span className="recap-label">Incassato</span><span className="recap-val" data-testid="recap-incassato">{formatEUR(recap.incassato)}</span></div>
              <div className="recap-row"><span className="recap-label">Nominale</span><span className="recap-val" data-testid="recap-nominale">{formatEUR(recap.nominale)}</span></div>
              <div className="recap-row"><span className="recap-label">Differenza</span><span className="recap-val" data-testid="recap-differenza">{formatEUR(recap.differenza)}</span></div>
              {recap.rendimento != null && (
                <div className="recap-row"><span className="recap-label">Rendimento</span><span className="recap-val" data-testid="recap-rendimento">{formatPct(recap.rendimento)}</span></div>
              )}
            </div>
          )}
          <div className="list bond-list">
            {visible.map((e) => (
              <BondRow key={e.bond.id} {...e} ritirato={vistaRitirati} portfolio={portfolioOf(e.bond.portafoglioId)} onOpen={onOpenBond} />
            ))}
            {visible.length === 0 && <div className="empty" style={{ gridColumn: '1 / -1' }}><p>Nessun buono in questo filtro.</p></div>}
          </div>
          {onBack && (
            <button className="btn ghost block" style={{ marginTop: 14 }} onClick={onGoAdd}>+ Aggiungi buono qui</button>
          )}
          </div>
        </div>
      )}
    </div>
  );
}
