import { useEffect, useMemo, useRef, useState } from 'react';
import seriesCatalog from '../data/series.json';
import { saveBond } from '../lib/db.js';
import { addYears, toInputDate, fromInputDate, dayOf, normalizeValuta, itlToEur, formatEUR, formatLire, ITL_PER_EUR, MAX_EUR, MAX_ITL } from '../lib/quote.js';
import { opzioniTabelle, inferTabellaDaData, normalizeTabellaTassi } from '../lib/tassi.js';
import { BackIcon, CameraIcon } from '../components/icons.jsx';

const plusYears = (d, y) => toInputDate(addYears(d, y));

export default function AddBond({ existing, portfolios, defaultPortfolioId, autoScan, onBack, onSaved }) {
  const isEdit = !!existing;
  const [scanMsg, setScanMsg] = useState('');
  const fileInputRef = useRef(null);
  useEffect(() => {
    if (autoScan) fileInputRef.current?.click();
  }, [autoScan]);

  const [form, setForm] = useState(() => ({
    tipo: existing?.tipo || 'bfp',
    serieKey: existing?.serieKey || '',
    serie: existing?.serie || '',
    numero: existing?.numero || '',
    valuta: normalizeValuta(existing?.valuta),
    nominale: existing?.nominale ?? '',
    dataEmissione: toInputDate(existing?.dataEmissione),
    dataScadenza: toInputDate(existing?.dataScadenza),
    dataPrescrizione: toInputDate(existing?.dataPrescrizione),
    valoreScadenza: existing?.valoreScadenza ?? '',
    intestatari: existing?.intestatari?.join(', ') || '',
    portafoglioId: existing?.portafoglioId || defaultPortfolioId || '',
    note: existing?.note || '',
    tabellaTassi: existing?.tabellaTassi || '',
  }));

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Ricalcola scadenza/prescrizione solo se non sono state modificate a mano
  // (vuote o uguali al valore calcolato in precedenza).
  const derive = (f, patch) => {
    const next = { ...f, ...patch };
    const meta = seriesCatalog[next.serieKey];
    const prevAutoScad = meta?.durataAnni && f.dataEmissione ? plusYears(f.dataEmissione, meta.durataAnni) : '';
    if (('dataEmissione' in patch || 'serieKey' in patch) && meta?.durataAnni && next.dataEmissione) {
      const prevMeta = seriesCatalog[f.serieKey];
      const prevAuto = prevMeta?.durataAnni && f.dataEmissione ? plusYears(f.dataEmissione, prevMeta.durataAnni) : '';
      if (!f.dataScadenza || f.dataScadenza === prevAuto || f.dataScadenza === prevAutoScad || 'serieKey' in patch) {
        next.dataScadenza = plusYears(next.dataEmissione, meta.durataAnni);
      }
    }
    if (next.dataScadenza !== f.dataScadenza) {
      const prevAutoPres = f.dataScadenza ? plusYears(f.dataScadenza, 10) : '';
      if (!f.dataPrescrizione || f.dataPrescrizione === prevAutoPres) {
        next.dataPrescrizione = next.dataScadenza ? plusYears(next.dataScadenza, meta?.prescrizioneAnni || 10) : '';
      }
    }
    return next;
  };

  const seriesOptions = useMemo(() => Object.entries(seriesCatalog), []);

  const handleSerieChange = (key) => {
    setForm((f) => derive(f, { serieKey: key, serie: seriesCatalog[key]?.label || (key ? f.serie : '') }));
  };

  const handleEmissioneChange = (val) => setForm((f) => derive(f, { dataEmissione: val }));

  const handleScadenzaChange = (val) => setForm((f) => derive(f, { dataScadenza: val }));

  const handleScanStub = () => {
    fileInputRef.current?.click();
  };

  const handleFilePicked = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanMsg('Scansione non disponibile in questa versione: conferma i campi manualmente qui sotto.');
    e.target.value = '';
  };

  const itl = form.valuta === 'ITL';
  const nominaleNum = Number(form.nominale);
  const vsNum = form.valoreScadenza === '' ? null : Number(form.valoreScadenza);
  const maxAmount = itl ? MAX_ITL : MAX_EUR;
  const unit = itl ? 'lire' : 'euro';
  const errors = [];
  if (form.valuta !== 'EUR' && form.valuta !== 'ITL') errors.push('Scegli la valuta del buono: euro o lire.');
  const badAmount = (n) => !Number.isFinite(n) || n <= 0 || (itl && (!Number.isInteger(n) || n < 1));
  if (form.nominale !== '' && badAmount(nominaleNum)) {
    errors.push(itl ? 'Il valore nominale in lire deve essere un numero intero di almeno 1 lira.' : 'Il valore nominale deve essere maggiore di zero.');
  } else if (form.nominale !== '' && nominaleNum > maxAmount) {
    errors.push(`Il valore nominale supera il massimo ammesso (${itl ? formatLire(MAX_ITL) : formatEUR(MAX_EUR)}).`);
  }
  if (vsNum != null && badAmount(vsNum)) {
    errors.push(itl ? 'Il valore a scadenza in lire deve essere un numero intero di almeno 1 lira.' : 'Il valore a scadenza deve essere maggiore di zero.');
  } else if (vsNum != null && vsNum > maxAmount) {
    errors.push(`Il valore a scadenza supera il massimo ammesso (${itl ? formatLire(MAX_ITL) : formatEUR(MAX_EUR)}).`);
  }
  if (form.dataEmissione && form.dataScadenza && dayOf(form.dataScadenza) <= dayOf(form.dataEmissione)) errors.push('La scadenza deve essere successiva all\'emissione.');
  if (form.dataScadenza && form.dataPrescrizione && dayOf(form.dataPrescrizione) < dayOf(form.dataScadenza)) errors.push('La prescrizione non può precedere la scadenza.');
  const numeroObbligatorio = !existing?.rimborsato;
  const canSave = (!numeroObbligatorio || !!form.numero.trim()) && form.nominale !== '' && errors.length === 0 && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    const datesChanged =
      !existing ||
      toInputDate(existing.dataScadenza) !== form.dataScadenza ||
      toInputDate(existing.dataPrescrizione) !== form.dataPrescrizione;
    const payload = {
      ...existing,
      tipo: form.tipo,
      serie: form.serie || (form.serieKey ? seriesCatalog[form.serieKey]?.label : ''),
      serieKey: form.serieKey,
      numero: form.numero.trim(),
      valuta: form.valuta,
      nominale: nominaleNum,
      dataEmissione: fromInputDate(form.dataEmissione),
      dataScadenza: fromInputDate(form.dataScadenza),
      dataPrescrizione: fromInputDate(form.dataPrescrizione),
      valoreScadenza: vsNum,
      intestatari: form.intestatari.split(',').map((s) => s.trim()).filter(Boolean),
      portafoglioId: form.portafoglioId || null,
      note: form.note.trim(),
      tabellaTassi: form.serieKey === 'ordinario' ? normalizeTabellaTassi(form.tabellaTassi) : '',
    };
    // Date cambiate: i promemoria già inviati si riferiscono alle date vecchie.
    if (datesChanged) payload.lastNotified = { scadenza: {}, prescrizione: {} };
    setSaving(true);
    setSaveError('');
    try {
      const saved = await saveBond(payload);
      await onSaved(saved.id);
    } catch {
      setSaveError('Salvataggio non riuscito: riprova.');
      setSaving(false);
    }
  };

  return (
    <div className="screen screen-enter form-narrow">
      <div className="top-actions">
        <button className="icon-btn" onClick={onBack} aria-label="Indietro"><BackIcon /></button>
      </div>
      <p className="eyebrow">Cassetto</p>
      <h1 className="title">{isEdit ? 'Modifica buono' : 'Aggiungi buono'}</h1>
      <p className="subtitle">I dati restano solo su questo dispositivo finché non esporti un backup.</p>

      <button className="btn ghost block" onClick={handleScanStub} style={{ marginBottom: 16 }}>
        <CameraIcon /> Scansiona il titolo
      </button>
      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" hidden onChange={handleFilePicked} />
      {scanMsg && <p className="disclaimer" style={{ marginTop: -8, marginBottom: 16 }}>{scanMsg}</p>}

      <div className="field-row">
        <div className="field">
          <label>Tipo</label>
          <select value={form.tipo} onChange={(e) => set('tipo', e.target.value)}>
            <option value="bfp">Buono Fruttifero Postale</option>
            <option value="altro">Altro titolo</option>
          </select>
        </div>
        <div className="field">
          <label>Serie</label>
          <select value={form.serieKey} onChange={(e) => handleSerieChange(e.target.value)}>
            <option value="">— Seleziona —</option>
            {seriesOptions.map(([key, meta]) => (
              <option key={key} value={key}>{meta.label}</option>
            ))}
          </select>
        </div>
      </div>

      {form.serieKey === 'ordinario' && (
        <div className="field">
          <label>Tabella tassi</label>
          <select value={form.tabellaTassi} onChange={(e) => set('tabellaTassi', e.target.value)} data-testid="tabella-tassi">
            <option value="">Automatica (da serie e data di emissione{form.dataEmissione && inferTabellaDaData(form.dataEmissione) ? ` · ${inferTabellaDaData(form.dataEmissione)}` : ''})</option>
            {opzioniTabelle().map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
          <p className="disclaimer" style={{ marginTop: 6, marginBottom: 0 }}>
            Per moduli sovratimbrati (es. modulo Q timbrato R) scegli la tabella del timbro.
          </p>
        </div>
      )}

      <div className="field">
        <label>Numero del buono{existing?.rimborsato ? ' (facoltativo)' : ''}</label>
        <input value={form.numero} onChange={(e) => set('numero', e.target.value)} placeholder="Es. AB1234567" />
      </div>

      <div className="field">
        <label id="valuta-label">Valuta del buono</label>
        <div className="seg-ctl" role="radiogroup" aria-labelledby="valuta-label">
          {[{ key: 'EUR', label: 'Euro (€)' }, { key: 'ITL', label: 'Lire (L.)' }].map((o) => (
            <button
              key={o.key}
              type="button"
              role="radio"
              aria-checked={form.valuta === o.key}
              className={form.valuta === o.key ? 'on' : ''}
              onClick={() => set('valuta', o.key)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label>Valore nominale ({itl ? 'lire' : '€'})</label>
          <input type="number" min={itl ? '1' : '0'} step={itl ? '1' : '0.01'} inputMode={itl ? 'numeric' : 'decimal'} value={form.nominale} onChange={(e) => set('nominale', e.target.value)} placeholder={itl ? '1000000' : '1000'} />
        </div>
        <div className="field">
          <label>Valore a scadenza ({itl ? 'lire' : '€'})</label>
          <input type="number" min={itl ? '1' : '0'} step={itl ? '1' : '0.01'} inputMode={itl ? 'numeric' : 'decimal'} value={form.valoreScadenza} onChange={(e) => set('valoreScadenza', e.target.value)} placeholder="facoltativo" />
        </div>
      </div>
      {itl && (
        <p className="disclaimer" style={{ marginTop: -6, marginBottom: 14 }} data-testid="conv-lire">
          Importi in {unit}, convertiti al cambio fisso 1 € = {ITL_PER_EUR.toLocaleString('it-IT', { minimumFractionDigits: 2 })} lire.
          {Number.isInteger(nominaleNum) && nominaleNum >= 1 && ` Nominale ≈ ${formatEUR(itlToEur(nominaleNum))}.`}
        </p>
      )}

      <div className="field-row">
        <div className="field">
          <label>Data emissione</label>
          <input type="date" value={form.dataEmissione} onChange={(e) => handleEmissioneChange(e.target.value)} />
        </div>
        <div className="field">
          <label>Data scadenza</label>
          <input type="date" value={form.dataScadenza} onChange={(e) => handleScadenzaChange(e.target.value)} />
        </div>
      </div>

      <div className="field">
        <label>Data prescrizione (di norma scadenza + 10 anni)</label>
        <input type="date" value={form.dataPrescrizione} onChange={(e) => set('dataPrescrizione', e.target.value)} />
      </div>

      <div className="field">
        <label>Intestatari (separati da virgola)</label>
        <input value={form.intestatari} onChange={(e) => set('intestatari', e.target.value)} placeholder="Mario Rossi, Anna Rossi" />
      </div>

      <div className="field">
        <label>Portafoglio</label>
        <select value={form.portafoglioId} onChange={(e) => set('portafoglioId', e.target.value)}>
          <option value="">Nessuno</option>
          {portfolios.map((p) => (
            <option key={p.id} value={p.id}>{p.nome}</option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>Note</label>
        <textarea value={form.note} onChange={(e) => set('note', e.target.value)} placeholder="Facoltative" />
      </div>

      {errors.length > 0 && (
        <div className="banner" role="alert">{errors.map((e) => <div key={e}>{e}</div>)}</div>
      )}
      {saveError && <div className="banner" role="alert">{saveError}</div>}
      {(numeroObbligatorio && !form.numero.trim()) || form.nominale === '' ? (
        <p className="disclaimer" style={{ marginTop: 0 }}>{numeroObbligatorio && !form.numero.trim() && form.nominale === '' ? 'Numero del buono e valore nominale sono obbligatori.' : numeroObbligatorio && !form.numero.trim() ? 'Il numero del buono è obbligatorio.' : 'Il valore nominale è obbligatorio.'}</p>
      ) : null}
      <button className="btn primary" disabled={!canSave} onClick={handleSave}>
        {isEdit ? 'Salva modifiche' : 'Salva buono'}
      </button>
    </div>
  );
}
