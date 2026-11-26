import { useMemo } from 'react';
import { daysUntil, formatDate, dayOf, maturazione } from '../lib/quote.js';
import Ring from '../components/Ring.jsx';

const gg = (n) => (n === 1 ? '1 giorno' : `${n} giorni`);

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

/** Tutte le date rilevanti (scadenza e prescrizione) dei buoni, in ordine cronologico. */
export function buildEvents(bonds, now = new Date()) {
  const out = [];
  for (const b of bonds) {
    for (const [field, kind] of [['dataScadenza', 'scadenza'], ['dataPrescrizione', 'prescrizione']]) {
      const day = dayOf(b[field]);
      if (day == null) continue;
      out.push({ bond: b, kind, day, days: daysUntil(b[field], now), mat: maturazione(b, now) });
    }
  }
  return out.sort((a, b) => a.day - b.day || String(a.bond.numero).localeCompare(String(b.bond.numero)));
}

const KIND_LABEL = { scadenza: 'scadenza', prescrizione: 'prescrizione' };

export default function Scadenze({ bonds, onOpenBond, onGoAdd }) {
  const events = useMemo(() => buildEvents(bonds), [bonds]);
  const next = events.find((e) => e.days >= 0);
  const who = (b) => (b.intestatari?.length ? b.intestatari.join(' e ') : 'Nessun intestatario');

  return (
    <div className="screen screen-enter screen-pin">
      <header className="stat-hero hero-main" data-testid="scadenze-hero">
        {LEAF}{LEAF2}
        <div className="hero-top">
          <div style={{ minWidth: 0 }}>
            <p className="hero-hello">Prossima finestra</p>
            {next ? (
              <>
                <h1 className="title hero-date" data-testid="prossima-data">{formatDate(next.day)}</h1>
                <p className="hero-sub">{next.bond.serie || 'Buono'} · n. {next.bond.numero}</p>
              </>
            ) : (
              <>
                <h1 className="title hero-date">Nessuna</h1>
                <p className="hero-sub">Nessuna scadenza futura tra i tuoi buoni.</p>
              </>
            )}
          </div>
          {next && (
            <Ring
              value={Math.min(1, next.days / 365)}
              label={String(next.days)}
              caption={next.days === 1 ? 'giorno' : 'giorni'}
              stroke="var(--ring)"
            />
          )}
        </div>
        {next && (
          <p className="hero-caption">
            {who(next.bond)} · {next.kind === 'prescrizione' ? 'ultimo giorno utile' : 'prima data utile'}
          </p>
        )}
      </header>

      {events.length === 0 ? (
        <div className="body-pad screen-col">
          <div className="screen-scroll" data-testid="list-scroll">
          <div className="empty">
            <div className="icon">📅</div>
            <p>Nessuna data da mostrare: aggiungi un buono con scadenza.</p>
            <button className="btn primary" style={{ marginTop: 14, width: 'auto', padding: '0 24px' }} onClick={onGoAdd}>Aggiungi il primo buono</button>
          </div>
          </div>
        </div>
      ) : (
        <div className="body-pad screen-col">
          <div className="screen-scroll" data-testid="list-scroll">
          <ol className="timeline-list">
            {events.map((e) => {
              const past = e.days < 0;
              const isNext = e === next;
              const matPct = e.mat == null ? null : Math.round(e.mat * 100);
              return (
                <li key={`${e.bond.id}-${e.kind}`} className={`tli${past ? ' past' : ''}${isNext ? ' next' : ''}`}>
                  <span className="tli-dot" aria-hidden="true" />
                  <button className="tli-card" onClick={() => onOpenBond(e.bond.id)}>
                    <span className="tli-head">
                      <span className="tli-date">{formatDate(e.day)}</span>
                      {past ? (
                        <span className="pill">Scaduto</span>
                      ) : isNext ? (
                        <span className="pill next">Prossima finestra</span>
                      ) : null}
                    </span>
                    <span className="tli-name">{e.bond.serie || 'Buono'} · n. {e.bond.numero}</span>
                    <span className="tli-meta">{who(e.bond)} · {KIND_LABEL[e.kind]}{isNext ? ` · tra ${gg(e.days)}` : ''}</span>
                    {isNext && matPct != null && (
                      <span className="mat">
                        <span className="mat-track"><i style={{ width: `${matPct}%`, background: 'var(--amber)' }} /></span>
                        <span className="mat-pct pc">{matPct}%</span>
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
          </div>
        </div>
      )}
    </div>
  );
}
