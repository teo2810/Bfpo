import { useMemo } from 'react';
import { quoteBond, formatEUR, daysUntil } from '../lib/quote.js';

function urgencyOf(bond, now) {
  const dScad = daysUntil(bond.dataScadenza, now);
  const dPres = daysUntil(bond.dataPrescrizione, now);
  let level = 'ok';
  let label = null;
  let criticalDays = Infinity;

  if (dPres != null && dPres <= 90) {
    level = 'danger';
    label = dPres < 0 ? `Prescritto da ${Math.abs(dPres)} gg` : `Prescrizione tra ${dPres} gg`;
    criticalDays = dPres;
  } else if (dScad != null && dScad <= 90) {
    level = 'warn';
    label = dScad < 0 ? `Scaduto da ${Math.abs(dScad)} gg` : `Scadenza tra ${dScad} gg`;
    criticalDays = dScad;
  } else {
    criticalDays = Math.min(dScad ?? Infinity, dPres ?? Infinity);
  }
  return { level, label, criticalDays };
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
}) {
  const now = new Date();

  const enriched = useMemo(
    () =>
      bonds.map((b) => ({
        bond: b,
        quote: quoteBond(b, now),
        urgency: urgencyOf(b, now),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bonds]
  );

  const totale = enriched.reduce((sum, e) => sum + e.quote.valore, 0);
  const sorted = [...enriched].sort((a, b) => a.urgency.criticalDays - b.urgency.criticalDays);
  const urgenti = sorted.filter((e) => e.urgency.level !== 'ok');

  const notVerified =
    lastOpenedPrevious && (Date.now() - new Date(lastOpenedPrevious).getTime()) / 86400000 > 90;

  const portfolioName = (id) => portfolios.find((p) => p.id === id)?.nome;

  return (
    <div className="screen screen-enter">
      <p className="eyebrow">Cassetto</p>
      <h1 className="title">{titleOverride || 'I tuoi buoni'}</h1>
      <p className="subtitle">Panoramica di tutti i titoli indicizzati.</p>

      {demoActive && (
        <div className="banner">
          Stai vedendo dati dimostrativi.{' '}
          <span style={{ textDecoration: 'underline', cursor: 'pointer' }} onClick={onStartFresh}>
            Inizia con i tuoi
          </span>
        </div>
      )}

      {notVerified && (
        <div className="banner">
          <strong>Cassetto non verificato.</strong> Non apri l'app da più di 90 giorni: controlla che
          scadenze e prescrizioni siano ancora corrette confrontando i titoli cartacei.
        </div>
      )}

      <div className="card stat-hero">
        <p className="eyebrow">Totale stimato</p>
        <p className={`value is-stima`}>{formatEUR(totale)}</p>
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
        <>
          {urgenti.length > 0 && (
            <>
              <p className="section-title">Da controllare</p>
              <div className="list">
                {urgenti.map(({ bond, quote, urgency }) => (
                  <button key={bond.id} className="row" onClick={() => onOpenBond(bond.id)}>
                    <div className="left">
                      <div className="name">{bond.serie || 'Buono'} · n. {bond.numero}</div>
                      <div className="meta">{portfolioName(bond.portafoglioId) || 'Senza portafoglio'}</div>
                    </div>
                    <div className="right">
                      <div className="amount">{formatEUR(quote.valore)}</div>
                      <span className={`pill ${urgency.level === 'danger' ? 'danger' : 'warn'}`}>{urgency.label}</span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          <p className="section-title">Tutti i buoni per data critica</p>
          <div className="list">
            {sorted.map(({ bond, quote }) => (
              <button key={bond.id} className="row" onClick={() => onOpenBond(bond.id)}>
                <div className="left">
                  <div className="name">{bond.serie || 'Buono'} · n. {bond.numero}</div>
                  <div className="meta">{portfolioName(bond.portafoglioId) || 'Senza portafoglio'}</div>
                </div>
                <div className="right">
                  <div className="amount">{formatEUR(quote.valore)}</div>
                  <span className="pill stima">stima</span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
