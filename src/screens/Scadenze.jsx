import { useMemo, useState } from 'react';
import { formatDate, formatEUR } from '../lib/quote.js';
import { buildEvents, groupEventsByDay, groupDaysByMonth, riepilogoGiorno } from '../lib/scadenze.js';
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

const KIND_LABEL = { scadenza: 'scadenza', prescrizione: 'prescrizione' };

/** Quota del tempo già trascorso verso la data, da emissione (o 1 anno prima) a scadenza. */
function avanzamentoVersoData(items, dayIso, now = new Date()) {
  const end = new Date(dayIso).getTime();
  const starts = (items || []).map((e) => new Date(e.bond.dataEmissione).getTime()).filter(Number.isFinite);
  const start = starts.length ? Math.min(...starts) : end - 365.25 * 86400000;
  if (!(end > start)) return 0;
  return Math.min(1, Math.max(0, (now.getTime() - start) / (end - start)));
}


export default function Scadenze({ bonds, onOpenBond, onGoAdd }) {
  const events = useMemo(() => buildEvents(bonds), [bonds]);
  const days = useMemo(() => groupEventsByDay(events), [events]);
  const months = useMemo(() => groupDaysByMonth(days), [days]);
  const next = days.find((g) => g.days >= 0);
  const who = (b) => (b.intestatari?.length ? b.intestatari.join(' e ') : 'Nessun intestatario');
  const nextItems = next?.items || [];
  const nextRecap = useMemo(() => riepilogoGiorno(nextItems), [nextItems]);
  const avanzamento = next ? avanzamentoVersoData(nextItems, next.day) : 0;
  const pctAvanzamento = next && next.days > 0 ? Math.min(99, Math.round(avanzamento * 100)) : (next ? 100 : 0);
  const [openDays, setOpenDays] = useState(() => new Set());
  const isDayOpen = (g) => {
    if (g.items.length <= 1) return true;
    if (openDays.has(g.day)) return true;
    if (openDays.has(`off-${g.day}`)) return false;
    return next != null && g.day === next.day; // la prossima è aperta di default
  };
  const toggleDay = (g) => {
    setOpenDays((prev) => {
      const n = new Set(prev);
      const open = isDayOpen(g);
      n.delete(g.day);
      n.delete(`off-${g.day}`);
      n.add(open ? `off-${g.day}` : g.day);
      return n;
    });
  };

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
                <p className="hero-sub" data-testid="prossima-riepilogo">
                  {nextRecap.count === 1 ? '1 buono' : `${nextRecap.count} buoni`} · {formatEUR(nextRecap.totale)}
                </p>
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
              value={avanzamento}
              label={String(next.days)}
              caption={next.days === 1 ? 'giorno' : 'giorni'}
              stroke="var(--ring)"
            />
          )}
        </div>
        {next && (
          <>
            <div className="split-bar" aria-hidden="true">
              <span className="cap" style={{ flex: Math.max(avanzamento, 0.0001) }} />
              <span className="int" style={{ flex: Math.max(1 - avanzamento, 0.0001) }} />
            </div>
            <div className="hero-legend">
              <div>
                <div className="leg-name"><span className="dot cap" />Avanzamento</div>
                <div className="leg-val">{pctAvanzamento}%</div>
              </div>
              <div>
                <div className="leg-name"><span className="dot int" />Mancano</div>
                <div className="leg-val">{next.days === 1 ? '1 giorno' : `${next.days} giorni`}</div>
              </div>
            </div>
          </>
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
            {months.map((month) => (
              <li key={month.key} className="tli-month-block">
                <p className="tli-month" data-testid="tli-mese">{month.label}</p>
                <ol className="timeline-list tli-month-days">
                  {month.days.map((g) => {
                    const past = g.days < 0;
                    const isNext = next != null && g.day === next.day;
                    const recap = riepilogoGiorno(g.items);
                    const open = isDayOpen(g);
                    return (
                      <li
                        key={g.day}
                        className={`tli${past ? ' past' : ''}${isNext ? ' next' : ''}${recap.count > 1 ? ' is-group' : ''}`}
                        data-testid={`scadenza-giorno-${g.day}`}
                        data-count={recap.count}
                      >
                        <span className="tli-dot" aria-hidden="true" />
                        <div className={`tli-card tli-bundle${isNext ? ' is-next' : ''}`}>
                          <div className="tli-head">
                            <span className="tli-date">{formatDate(g.day)}</span>
                            {recap.count > 1 && <span className="pill" data-testid="conteggio-giorno">{recap.count} buoni · {formatEUR(recap.totale)}</span>}
                            {past ? (
                              <span className="pill">Scaduto</span>
                            ) : isNext ? (
                              <span className="pill next">Prossima finestra</span>
                            ) : null}
                          </div>
                          {recap.count > 1 && (
                            <button
                              type="button"
                              className="tli-expand"
                              aria-expanded={open}
                              data-testid={isNext ? 'gruppo-espandi' : undefined}
                              onClick={() => toggleDay(g)}
                            >
                              {open ? 'Nascondi elenco' : 'Mostra elenco'}
                            </button>
                          )}
                          {open && (
                            <ul className="tli-elenco">
                              {g.items.map((e) => {
                                const matPct = e.mat == null ? null : Math.round(e.mat * 100);
                                return (
                                  <li key={`${e.bond.id}-${e.kind}`}>
                                    <button
                                      type="button"
                                      className="tli-line"
                                      data-testid={`tli-buono-${e.bond.id}`}
                                      onClick={() => onOpenBond(e.bond.id)}
                                    >
                                      <span className="tli-name">{e.bond.serie || 'Buono'}{e.bond.numero ? ` · n. ${e.bond.numero}` : ''}</span>
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
                            </ul>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </li>
            ))}
          </ol>
          </div>
        </div>
      )}
    </div>
  );
}
