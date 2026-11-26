import { useMemo } from 'react';
import { daysUntil, formatDate, dayOf } from '../lib/quote.js';
import Ring from '../components/Ring.jsx';

const gg = (n) => (n === 1 ? '1 giorno' : `${n} giorni`);

/** Tutte le date rilevanti (scadenza e prescrizione) dei buoni, in ordine cronologico. */
export function buildEvents(bonds, now = new Date()) {
  const out = [];
  for (const b of bonds) {
    for (const [field, kind] of [['dataScadenza', 'scadenza'], ['dataPrescrizione', 'prescrizione']]) {
      const day = dayOf(b[field]);
      if (day == null) continue;
      out.push({ bond: b, kind, day, days: daysUntil(b[field], now) });
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
    <div className="screen screen-enter">
      <header className="stat-hero hero-main">
        <div className="hero-top">
          <div style={{ minWidth: 0 }}>
            <p className="hero-hello">Prossima finestra</p>
            {next ? (
              <>
                <h1 className="title hero-date" data-testid="prossima-data">{formatDate(next.day)}</h1>
                <p className="hero-sub">{next.bond.serie || 'Buono'} · n. {next.bond.numero}</p>
                <p className="hero-sub strong">{who(next.bond)} · {next.kind === 'prescrizione' ? 'ultimo giorno utile' : 'prima data utile'}</p>
              </>
            ) : (
              <>
                <h1 className="title hero-date">Nessuna</h1>
                <p className="hero-sub">Nessuna scadenza futura tra i tuoi buoni.</p>
              </>
            )}
          </div>
          {next && <Ring value={Math.min(1, next.days / 365)} label={String(next.days)} caption={next.days === 1 ? 'GIORNO' : 'GIORNI'} />}
        </div>
      </header>

      {events.length === 0 ? (
        <div className="empty">
          <div className="icon">📅</div>
          <p>Nessuna data da mostrare: aggiungi un buono con scadenza.</p>
          <button className="btn primary" style={{ marginTop: 14, width: 'auto', padding: '0 24px' }} onClick={onGoAdd}>Aggiungi il primo buono</button>
        </div>
      ) : (
        <ol className="timeline-list">
          {events.map((e) => {
            const past = e.days < 0;
            const isNext = e === next;
            return (
              <li key={`${e.bond.id}-${e.kind}`} className={`tli${past ? ' past' : ''}${isNext ? ' next' : ''}`}>
                <span className="tli-dot" aria-hidden="true" />
                <button className="tli-card" onClick={() => onOpenBond(e.bond.id)}>
                  <span className="tli-head">
                    <span className="tli-date">{formatDate(e.day)}</span>
                    {past ? (
                      <span className="pill">Scaduto</span>
                    ) : isNext ? (
                      <span className="pill ok">Prossima finestra</span>
                    ) : (
                      <span className="pill warn">tra {gg(e.days)}</span>
                    )}
                  </span>
                  <span className="tli-name">{e.bond.serie || 'Buono'} · n. {e.bond.numero}</span>
                  <span className="tli-meta">{who(e.bond)} · {KIND_LABEL[e.kind]}{isNext ? ` · tra ${gg(e.days)}` : ''}</span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
