import { useState } from 'react';
import { quoteBond, formatEUR, formatLire, daysUntil, formatDate, impliedAnnualRate, formatPct, nominaleEUR, normalizeValuta, ITL_PER_EUR, toInputDate, fromInputDate, dayOf, MAX_EUR } from '../lib/quote.js';
import { cronologiaStati } from '../lib/cronologia.js';
import { isRitirato } from '../lib/ritirati.js';
import { isStrictCalendarDate } from '../lib/backup.js';
import { deleteBond, saveBond } from '../lib/db.js';
import { bondToICS, downloadICS } from '../lib/ics.js';
import { BackIcon, EditIcon } from '../components/icons.jsx';
import { urgencyOf } from './Home.jsx';

function cronoSteps(bond, now) {
  const dScad = daysUntil(bond.dataScadenza, now);
  const dPres = daysUntil(bond.dataPrescrizione, now);
  const steps = [
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
  ];
  if (isRitirato(bond) && bond.dataRimborso) {
    const rDay = dayOf(bond.dataRimborso);
    const kept = steps.filter((s) => {
      const d = dayOf(s.date);
      return d != null && rDay != null && d <= rDay;
    });
    kept.push({
      label: 'Rimborso',
      date: bond.dataRimborso,
      hint: bond.importoIncassato != null ? formatEUR(bond.importoIncassato) : null,
    });
    kept.sort((a, b) => (dayOf(a.date) ?? 0) - (dayOf(b.date) ?? 0));
    return kept;
  }
  return steps;
}

export default function Bond({ bond, portfolios, onBack, onEdit, onDeleted, onUpdated }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [ritiro, setRitiro] = useState(false);
  const [ritiroData, setRitiroData] = useState(() => toInputDate(new Date()));
  const [ritiroImporto, setRitiroImporto] = useState('');
  const [ritiroErrore, setRitiroErrore] = useState('');
  const [ritiroBusy, setRitiroBusy] = useState(false);
  const now = new Date();
  const stimaOggi = quoteBond(bond, now);
  const stimaScadenza = bond.dataScadenza ? quoteBond(bond, bond.dataScadenza) : null;
  const tasso = impliedAnnualRate(bond);
  const lire = normalizeValuta(bond.valuta) === 'ITL';
  const ritirato = isRitirato(bond);
  const urgency = ritirato ? { label: null, level: 'ok' } : urgencyOf(bond, now);
  const portafoglio = portfolios.find((p) => p.id === bond.portafoglioId);
  const titolo = bond.numero ? `${bond.serie || 'Buono'} · n. ${bond.numero}` : (bond.serie || 'Buono');
  const handleExportIcs = () => {
    downloadICS(bondToICS(bond), `buono-${bond.numero || bond.id}`);
  };

  const handleDelete = async () => {
    await deleteBond(bond.id);
    onDeleted();
  };

  const apriRitiro = () => {
    setRitiroData(toInputDate(new Date()));
    setRitiroImporto(String(Math.round(stimaOggi.valore * 100) / 100));
    setRitiroErrore('');
    setRitiro(true);
  };

  const confermaRitiro = async () => {
    if (!isStrictCalendarDate(ritiroData) || !ritiroData) {
      setRitiroErrore('Indica una data di rimborso valida.');
      return;
    }
    const n = Number(String(ritiroImporto).replace(',', '.'));
    if (!Number.isFinite(n) || n < 0 || n > MAX_EUR) {
      setRitiroErrore('Indica un importo incassato in euro valido.');
      return;
    }
    setRitiroBusy(true);
    setRitiroErrore('');
    try {
      await saveBond({ ...bond, rimborsato: true, dataRimborso: fromInputDate(ritiroData), importoIncassato: n });
      setRitiro(false);
      onUpdated?.();
    } catch {
      setRitiroErrore('Salvataggio non riuscito: riprova.');
      setRitiroBusy(false);
    }
  };

  const annullaRitiro = async () => {
    setRitiroBusy(true);
    try {
      await saveBond({ ...bond, rimborsato: false, dataRimborso: null, importoIncassato: null });
      onUpdated?.();
    } catch {
      setRitiroBusy(false);
    }
  };

  const crono = cronologiaStati(cronoSteps(bond, now), now);

  return (
    <div className="screen screen-enter">
      <div className="top-actions">
        <button className="icon-btn" onClick={onBack} aria-label="Indietro"><BackIcon /></button>
        <button className="icon-btn" onClick={() => onEdit(bond.id)} aria-label="Modifica"><EditIcon /></button>
      </div>

      <p className="eyebrow">{portafoglio?.nome || 'Senza portafoglio'}</p>
      <h1 className="title">{titolo}</h1>
      <p className="subtitle">{bond.intestatari?.join(', ') || 'Nessun intestatario indicato'}</p>

      {ritirato && (
        <div className="banner info">Ritirato{bond.dataRimborso ? ` il ${formatDate(bond.dataRimborso)}` : ''}{bond.importoIncassato != null ? ` · incassati ${formatEUR(bond.importoIncassato)}` : ''}.</div>
      )}
      {urgency.label && <div className={`banner ${urgency.level === 'danger' ? '' : 'warn'}`}>{urgency.label}</div>}

      <div className="bond-grid">
      <div className="card stat-hero">
        <p className="eyebrow">{ritirato ? 'Importo incassato' : 'Valore stimato oggi'}</p>
        <p className="value is-stima" data-testid="valore-oggi">{ritirato && bond.importoIncassato != null ? formatEUR(bond.importoIncassato) : formatEUR(stimaOggi.valore)}</p>
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
      {ritirato ? (
        <button className="btn ghost block" data-testid="annulla-ritiro" disabled={ritiroBusy} onClick={annullaRitiro}>Annulla ritiro</button>
      ) : ritiro ? (
        <div className="card" data-testid="modulo-ritiro" style={{ marginBottom: 12 }}>
          <p style={{ margin: '0 0 12px', fontSize: 14 }}>Segna questo buono come ritirato. L&apos;importo è in euro, netto.</p>
          <div className="field">
            <label htmlFor="ritiro-data">Data di rimborso</label>
            <input id="ritiro-data" type="date" value={ritiroData} onChange={(e) => setRitiroData(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="ritiro-importo">Importo incassato (€)</label>
            <input id="ritiro-importo" inputMode="decimal" value={ritiroImporto} onChange={(e) => setRitiroImporto(e.target.value)} />
          </div>
          {ritiroErrore && <div className="banner" role="alert">{ritiroErrore}</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn ghost" style={{ flex: 1 }} disabled={ritiroBusy} onClick={() => setRitiro(false)}>Annulla</button>
            <button className="btn primary" style={{ flex: 1 }} data-testid="conferma-ritiro" disabled={ritiroBusy} onClick={confermaRitiro}>Conferma</button>
          </div>
        </div>
      ) : (
        <button className="btn ghost block" data-testid="segna-ritirato" onClick={apriRitiro}>Segna come ritirato</button>
      )}
      {!ritirato && <button className="btn ghost block" onClick={handleExportIcs}>Esporta promemoria (.ics)</button>}

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
