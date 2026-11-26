import { useMemo } from 'react';
import { quoteBond, formatEUR, daysUntil, formatDate } from '../lib/quote.js';
import { BackIcon } from '../components/icons.jsx';

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

function BondRow({ bond, quote, urgency, portfolio, onOpen, showPill }) {
  const color = portfolio ? `var(--${portfolio.colore})` : 'var(--text-2)';
  return (
    <button className="row" onClick={() => onOpen(bond.id)} style={{ ['--row-accent']: color }}>
      <div className="left">
        <div className="name">{bond.serie || 'Buono'} · n. {bond.numero}</div>
        <div className="meta">
          {portfolio?.nome || 'Senza portafoglio'}
          {bond.dataScadenza ? ` · scad. ${formatDate(bond.dataScadenza)}` : ''}
        </div>
      </div>
      <div className="right">
        <div className="amount">{formatEUR(quote.valore)}</div>
        {showPill && urgency.label ? (
          <span className={`pill ${urgency.level}`}>{urgency.label}</span>
        ) : (
          <span className="pill stima">stima</span>
        )}
      </div>
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
  const enriched = useMemo(() => {
    const now = new Date();
    return bonds.map((b) => ({ bond: b, quote: quoteBond(b, now), urgency: urgencyOf(b, now) }));
  }, [bonds]);

  const totale = enriched.reduce((sum, e) => sum + e.quote.valore, 0);
  const capitale = enriched.reduce((sum, e) => sum + (Number(e.bond.nominale) || 0), 0);
  const interessi = totale - capitale;
  const sorted = [...enriched].sort(byCriticalDays);
  const urgenti = sorted.filter((e) => e.urgency.level !== 'ok');

  const notVerified =
    lastOpenedPrevious && (Date.now() - new Date(lastOpenedPrevious).getTime()) / 86400000 > 90;

  const portfolioOf = (id) => portfolios.find((p) => p.id === id);

  return (
    <div className="screen screen-enter">
      {onBack && (
        <div className="top-actions">
          <button className="icon-btn" onClick={onBack} aria-label="Indietro"><BackIcon /></button>
        </div>
      )}
      <p className="eyebrow">Cassetto</p>
      <h1 className="title">{titleOverride || 'I tuoi buoni'}</h1>
      <p className="subtitle">{subtitleOverride || 'Panoramica di tutti i titoli indicizzati.'}</p>

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

      <div className="card stat-hero">
        <p className="eyebrow">Totale stimato oggi</p>
        <p className="value is-stima" data-testid="totale">{formatEUR(totale)}</p>
        <div className="hero-stats">
          <div><span>Buoni</span><strong>{bonds.length}</strong></div>
          <div><span>Capitale</span><strong>{formatEUR(capitale)}</strong></div>
          <div><span>Interessi (stima)</span><strong className={interessi >= 0 ? 'pos' : 'neg'}>{formatEUR(interessi)}</strong></div>
          <div><span>Da controllare</span><strong className={urgenti.length ? 'neg' : ''}>{urgenti.length}</strong></div>
        </div>
      </div>

      {bonds.length === 0 ? (
        <div className="empty">
          <div className="icon">🗂️</div>
          <p>Nessun buono ancora indicizzato.</p>
          <button className="btn primary" style={{ marginTop: 14, width: 'auto', padding: '0 24px' }} onClick={onGoAdd}>
            Aggiungi il primo buono
          </button>
        </div>
      ) : (
        <div className="home-cols">
          {urgenti.length > 0 && (
            <section>
              <p className="section-title">Da controllare</p>
              <div className="list">
                {urgenti.map((e) => (
                  <BondRow key={e.bond.id} {...e} portfolio={portfolioOf(e.bond.portafoglioId)} onOpen={onOpenBond} showPill />
                ))}
              </div>
            </section>
          )}
          <section>
            <p className="section-title">Tutti i buoni per data critica</p>
            <div className="list">
              {sorted.map((e) => (
                <BondRow key={e.bond.id} {...e} portfolio={portfolioOf(e.bond.portafoglioId)} onOpen={onOpenBond} />
              ))}
            </div>
            {onBack && (
              <button className="btn ghost block" style={{ marginTop: 14 }} onClick={onGoAdd}>+ Aggiungi buono qui</button>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
