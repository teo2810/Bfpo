import { useState } from 'react';
import { quoteBond, formatEUR, formatLire, daysUntil, formatDate, impliedAnnualRate, formatPct, nominaleEUR, normalizeValuta, ITL_PER_EUR } from '../lib/quote.js';
import { cronologiaStati } from '../lib/cronologia.js';
import { deleteBond } from '../lib/db.js';
import { bondToICS, downloadICS } from '../lib/ics.js';
import { BackIcon, EditIcon } from '../components/icons.jsx';
import { urgencyOf } from './Home.jsx';


export default function Bond({ bond, portfolios, onBack, onEdit, onDeleted }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const now = new Date();
  const stimaOggi = quoteBond(bond, now);
  const stimaScadenza = bond.dataScadenza ? quoteBond(bond, bond.dataScadenza) : null;
  const tasso = impliedAnnualRate(bond);
  const lire = normalizeValuta(bond.valuta) === 'ITL';
  const urgency = urgencyOf(bond, now);
  const dScad = daysUntil(bond.dataScadenza);
  const dPres = daysUntil(bond.dataPrescrizione);
  const portafoglio = portfolios.find((p) => p.id === bond.portafoglioId);
  const handleExportIcs = () => {
    downloadICS(bondToICS(bond), `buono-${bond.numero || bond.id}`);
  };

  const handleDelete = async () => {
    await deleteBond(bond.id);
    onDeleted();
  };

  const crono = cronologiaStati([
    { label: 'Emissione', date: bond.dataEmissione },
    {
      label: 'Scadenza',
      date: bond.dataScadenza,
      hint: dScad == null ? null : dScad < 0 ? `scaduto da ${-dScad} gg` : dScad === 0 ? 'oggi' : `tra ${dScad} gg`,
    },
    {
      label: 'Prescrizione',
      date: bond.dataPrescrizione,
      hint: dPres == null ? null : dPres < 0 ? `prescritto da ${-dPres} gg` : dPres === 0 ? 'oggi' : `tra ${dPres} gg`,
    },
  ], now);

  return (
    <div className="screen screen-enter">
      <div className="top-actions">
        <button className="icon-btn" onClick={onBack} aria-label="Indietro"><BackIcon /></button>
        <button className="icon-btn" onClick={() => onEdit(bond.id)} aria-label="Modifica"><EditIcon /></button>
      </div>

      <p className="eyebrow">{portafoglio?.nome || 'Senza portafoglio'}</p>
      <h1 className="title">{bond.serie || 'Buono'} · n. {bond.numero}</h1>
      <p className="subtitle">{bond.intestatari?.join(', ') || 'Nessun intestatario indicato'}</p>

      {urgency.label && <div className={`banner ${urgency.level === 'danger' ? '' : 'warn'}`}>{urgency.label}</div>}

      <div className="bond-grid">
      <div className="card stat-hero">
        <p className="eyebrow">Valore stimato oggi</p>
        <p className="value is-stima" data-testid="valore-oggi">{formatEUR(stimaOggi.valore)}</p>
        <div className="hero-stats">
          <div>
            <span>Nominale</span>
            <strong data-testid="nominale">{lire ? formatLire(bond.nominale) : formatEUR(bond.nominale)}</strong>
            {lire && <span className="sub">≈ {formatEUR(nominaleEUR(bond))}</span>}
          </div>
          <div>
            <span>A scadenza</span>
            <strong>{stimaScadenza ? formatEUR(stimaScadenza.valore) : '—'}</strong>
            {lire && stimaScadenza && <span className="sub">{formatLire(stimaScadenza.valoreOriginale)}</span>}
          </div>
          <div><span>Interessi oggi</span><strong className="pos">{formatEUR(stimaOggi.valore - nominaleEUR(bond))}</strong></div>
          <div><span>Tasso medio annuo</span><strong data-testid="tasso">{formatPct(tasso)}</strong></div>
        </div>
        {lire && (
          <p className="disclaimer" data-testid="nota-lire">
            Buono in lire: oggi vale circa {formatLire(stimaOggi.valoreOriginale)} (stima), convertite in euro al cambio fisso di {ITL_PER_EUR.toLocaleString('it-IT', { minimumFractionDigits: 2 })} lire per euro. I totali sono sempre in euro.
          </p>
        )}
        {stimaOggi.metodo === 'nominale' && (
          <p className="disclaimer">Senza valore a scadenza non è possibile stimare gli interessi: viene mostrato il nominale.</p>
        )}
      </div>

      <div className="card">
        <p className="eyebrow">Cronologia</p>
        <div className="timeline" data-testid="cronologia">
          {crono.items.map((t, i) => (
            <div
              key={t.label}
              className={`tl-item is-${t.state}`}
              data-stato={t.stato}
              aria-label={`${t.label}, ${formatDate(t.date)}, ${t.stato}`}
            >
              <div className="tl-dot" aria-hidden="true" />
              {i < crono.segments.length && (
                <div className="tl-seg" aria-hidden="true">
                  <div className="tl-seg-fill" style={{ height: `${Math.round(crono.segments[i] * 1000) / 10}%` }} />
                </div>
              )}
              <div className="tl-label">
                {t.label}
                <span className="tl-state">{t.stato}</span>
              </div>
              <div className="tl-date">{formatDate(t.date)}{t.hint && <span className="tl-hint"> · {t.hint}</span>}</div>
            </div>
          ))}
        </div>
      </div>

      </div>

      {bond.note && (
        <>
          <p className="section-title">Note</p>
          <div className="card"><p style={{ margin: 0, fontSize: 14, whiteSpace: 'pre-wrap' }}>{bond.note}</p></div>
        </>
      )}

      <p className="section-title">Azioni</p>
      <button className="btn ghost block" onClick={handleExportIcs}>Esporta promemoria (.ics)</button>

      {confirmDelete ? (
        <div className="card" style={{ marginTop: 12 }}>
          <p style={{ margin: '0 0 12px', fontSize: 14 }}>Eliminare definitivamente questo buono da Cassetto? Il titolo cartaceo resta valido: qui elimini solo la scheda.</p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn ghost" style={{ flex: 1 }} onClick={() => setConfirmDelete(false)}>Annulla</button>
            <button className="btn danger-ghost" style={{ flex: 1 }} onClick={handleDelete}>Elimina</button>
          </div>
        </div>
      ) : (
        <button className="btn danger-ghost block" style={{ marginTop: 10 }} onClick={() => setConfirmDelete(true)}>
          Elimina scheda
        </button>
      )}
    </div>
  );
}
