import { useState } from 'react';
import { quoteBond, formatEUR, daysUntil } from '../lib/quote.js';
import { saveBond, deleteBond } from '../lib/db.js';
import { bondToICS, downloadICS } from '../lib/ics.js';
import { BackIcon } from '../components/icons.jsx';

const CHECKLIST_ITEMS = [
  { key: 'documento', label: 'Documento d\'identità valido' },
  { key: 'cf', label: 'Codice fiscale / tessera sanitaria' },
  { key: 'titolo', label: 'Titolo cartaceo originale' },
  { key: 'ufficio', label: 'Prenotazione o turno in ufficio postale' },
  { key: 'dematerializza', label: 'Valuta la dematerializzazione' },
];

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function Bond({ bond, portfolios, onBack, onEdit, onReload, onDeleted }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const now = new Date();
  const stimaOggi = quoteBond(bond, now);
  const stimaScadenza = bond.dataScadenza ? quoteBond(bond, bond.dataScadenza) : null;
  const dScad = daysUntil(bond.dataScadenza);
  const dPres = daysUntil(bond.dataPrescrizione);
  const portafoglio = portfolios.find((p) => p.id === bond.portafoglioId);
  const checklist = bond.checklist || {};

  const toggleCheck = async (key) => {
    const updated = { ...bond, checklist: { ...checklist, [key]: !checklist[key] } };
    await saveBond(updated);
    onReload();
  };

  const handleExportIcs = () => {
    downloadICS(bondToICS(bond), `buono-${bond.numero || bond.id}`);
  };

  const handleDelete = async () => {
    await deleteBond(bond.id);
    onDeleted();
  };

  const timelineItems = [
    { label: 'Emissione', date: bond.dataEmissione, status: 'ok' },
    {
      label: 'Scadenza',
      date: bond.dataScadenza,
      status: dScad != null && dScad <= 90 ? 'warn' : 'ok',
    },
    {
      label: 'Prescrizione',
      date: bond.dataPrescrizione,
      status: dPres != null && dPres <= 90 ? 'danger' : 'ok',
    },
  ].filter((t) => t.date);

  return (
    <div className="screen screen-enter">
      <div className="top-actions">
        <button className="icon-btn" onClick={onBack} aria-label="Indietro"><BackIcon /></button>
        <button className="icon-btn" onClick={() => onEdit(bond.id)} aria-label="Modifica">✎</button>
      </div>

      <p className="eyebrow">{portafoglio?.nome || 'Senza portafoglio'}</p>
      <h1 className="title">{bond.serie || 'Buono'} · n. {bond.numero}</h1>
      <p className="subtitle">{bond.intestatari?.join(', ') || 'Nessun intestatario indicato'}</p>

      <div className="card">
        <p className="eyebrow">Valore oggi</p>
        <p className="value is-stima" style={{ fontFamily: 'var(--font-display)', fontSize: 32, margin: '2px 0 12px' }}>
          {formatEUR(stimaOggi.valore)}
        </p>
        <div className="legend" style={{ marginTop: 0 }}>
          <span>Nominale: {formatEUR(bond.nominale)}</span>
          {stimaScadenza && <span>A scadenza: {formatEUR(stimaScadenza.valore)} (stima)</span>}
        </div>
      </div>

      <p className="section-title">Cronologia</p>
      <div className="card">
        <div className="timeline">
          {timelineItems.map((t) => (
            <div key={t.label} className={`tl-item ${t.status}`}>
              <div className="tl-dot" />
              <div className="tl-label">{t.label}</div>
              <div className="tl-date">{fmtDate(t.date)}</div>
            </div>
          ))}
        </div>
      </div>

      <p className="section-title">Checklist rimborso</p>
      <div className="checklist">
        {CHECKLIST_ITEMS.map((item) => (
          <div key={item.key} className={`check-item${checklist[item.key] ? ' done' : ''}`} onClick={() => toggleCheck(item.key)}>
            <div className="box">{checklist[item.key] ? '✓' : ''}</div>
            <span className="label">{item.label}</span>
          </div>
        ))}
      </div>

      {bond.note && (
        <>
          <p className="section-title">Note</p>
          <div className="card"><p style={{ margin: 0, fontSize: 14 }}>{bond.note}</p></div>
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
