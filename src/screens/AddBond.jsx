import { useMemo, useRef, useState } from 'react';
import seriesCatalog from '../data/series.json';
import { saveBond } from '../lib/db.js';
import { addYears } from '../lib/quote.js';
import { BackIcon, CameraIcon } from '../components/icons.jsx';

function toInputDate(iso) {
  if (!iso) return '';
  return new Date(iso).toISOString().slice(0, 10);
}

export default function AddBond({ existing, portfolios, onBack, onSaved }) {
  const isEdit = !!existing;
  const [scanMsg, setScanMsg] = useState('');
  const fileInputRef = useRef(null);

  const [form, setForm] = useState(() => ({
    tipo: existing?.tipo || 'bfp',
    serieKey: existing?.serieKey || '',
    serie: existing?.serie || '',
    numero: existing?.numero || '',
    nominale: existing?.nominale ?? '',
    dataEmissione: toInputDate(existing?.dataEmissione),
    dataScadenza: toInputDate(existing?.dataScadenza),
    dataPrescrizione: toInputDate(existing?.dataPrescrizione),
    valoreScadenza: existing?.valoreScadenza ?? '',
    intestatari: existing?.intestatari?.join(', ') || '',
    portafoglioId: existing?.portafoglioId || '',
    note: existing?.note || '',
  }));

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const seriesOptions = useMemo(() => Object.entries(seriesCatalog), []);

  const handleSerieChange = (key) => {
    const meta = seriesCatalog[key];
    set('serieKey', key);
    set('serie', meta?.label || '');
    if (meta?.durataAnni && form.dataEmissione) {
      const scad = addYears(form.dataEmissione, meta.durataAnni);
      set('dataScadenza', toInputDate(scad));
      set('dataPrescrizione', toInputDate(addYears(scad, meta.prescrizioneAnni || 10)));
    }
  };

  const handleEmissioneChange = (val) => {
    set('dataEmissione', val);
    const meta = seriesCatalog[form.serieKey];
    if (meta?.durataAnni && val) {
      const scad = addYears(val, meta.durataAnni);
      set('dataScadenza', toInputDate(scad));
      set('dataPrescrizione', toInputDate(addYears(scad, meta.prescrizioneAnni || 10)));
    }
  };

  const handleScadenzaChange = (val) => {
    set('dataScadenza', val);
    if (val && !form.dataPrescrizione) {
      set('dataPrescrizione', toInputDate(addYears(val, 10)));
    }
  };

  const handleScanStub = () => {
    fileInputRef.current?.click();
  };

  const handleFilePicked = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanMsg('Scansione non disponibile in questa versione: conferma i campi manualmente qui sotto.');
    e.target.value = '';
  };

  const canSave = form.numero.trim() && form.nominale !== '';

  const handleSave = async () => {
    if (!canSave) return;
    const payload = {
      ...(existing || {}),
      tipo: form.tipo,
      serie: form.serie || (form.serieKey ? seriesCatalog[form.serieKey]?.label : ''),
      serieKey: form.serieKey,
      numero: form.numero.trim(),
      nominale: Number(form.nominale) || 0,
      dataEmissione: form.dataEmissione ? new Date(form.dataEmissione).toISOString() : null,
      dataScadenza: form.dataScadenza ? new Date(form.dataScadenza).toISOString() : null,
      dataPrescrizione: form.dataPrescrizione ? new Date(form.dataPrescrizione).toISOString() : null,
      valoreScadenza: form.valoreScadenza !== '' ? Number(form.valoreScadenza) : null,
      intestatari: form.intestatari.split(',').map((s) => s.trim()).filter(Boolean),
      portafoglioId: form.portafoglioId || null,
      note: form.note,
    };
    const saved = await saveBond(payload);
    onSaved(saved.id);
  };

  return (
    <div className="screen screen-enter">
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

      <div className="field">
        <label>Numero del buono</label>
        <input value={form.numero} onChange={(e) => set('numero', e.target.value)} placeholder="Es. AB1234567" />
      </div>

      <div className="field-row">
        <div className="field">
          <label>Valore nominale (€)</label>
          <input type="number" inputMode="decimal" value={form.nominale} onChange={(e) => set('nominale', e.target.value)} placeholder="1000" />
        </div>
        <div className="field">
          <label>Valore a scadenza (€, se noto)</label>
          <input type="number" inputMode="decimal" value={form.valoreScadenza} onChange={(e) => set('valoreScadenza', e.target.value)} placeholder="facoltativo" />
        </div>
      </div>

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

      <button className="btn primary" disabled={!canSave} onClick={handleSave}>
        {isEdit ? 'Salva modifiche' : 'Salva buono'}
      </button>
    </div>
  );
}
