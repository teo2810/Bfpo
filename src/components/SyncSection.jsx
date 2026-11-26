import { useState, useSyncExternalStore } from 'react';
import { clearSyncConfig, configChanged, getSyncConfig, getSyncStatus, saveSyncConfig, subscribeSync, syncNow } from '../lib/sync.js';
import { syncLabel } from './SyncChip.jsx';

const fmtDateTime = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export default function SyncSection() {
  const s = useSyncExternalStore(subscribeSync, getSyncStatus);
  const [cfg, setCfg] = useState(() => getSyncConfig());
  const [url, setUrl] = useState(cfg?.url || '');
  const [key, setKey] = useState(cfg?.key || '');
  const [msg, setMsg] = useState('');
  const [confirmOff, setConfirmOff] = useState(false);
  const connected = !!cfg;

  const save = async () => {
    const r = saveSyncConfig({ url, key });
    if (!r.ok) {
      setMsg(r.error);
      return;
    }
    setCfg(getSyncConfig());
    setUrl(getSyncConfig().url);
    setMsg('');
    const res = await configChanged();
    if (res.ok) setMsg(res.changed ? `Sincronizzato: ${res.changed} modifiche ricevute dal foglio.` : 'Sincronizzato.');
  };
  const now = async () => {
    setMsg('');
    const res = await syncNow();
    if (res.ok) setMsg(res.changed ? `Sincronizzato: ${res.changed} modifiche ricevute dal foglio.` : 'Sincronizzato, nessuna novità.');
  };
  const disconnect = () => {
    clearSyncConfig();
    setCfg(null);
    setUrl('');
    setKey('');
    setConfirmOff(false);
    setMsg('Sincronizzazione disattivata. I dati restano su questo dispositivo e nel foglio.');
  };

  const label = syncLabel(s);
  return (
    <>
      <p className="section-title" id="sezione-sync">Sincronizzazione Google Sheet</p>
      <div className="card">
        <p className="disclaimer" style={{ marginTop: 0 }}>
          Facoltativa. I dati restano su questo dispositivo e Cassetto funziona anche offline; con uno Sheet
          tuo li tieni allineati tra più dispositivi. Segui i 5 passi nell'intestazione di <code>apps-script/Code.gs</code>.
          URL e chiave restano solo qui e non finiscono nei backup.
        </p>
        <div className="field">
          <label htmlFor="sync-url">URL della web app</label>
          <input id="sync-url" inputMode="url" autoComplete="off" autoCapitalize="off" spellCheck={false} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://script.google.com/macros/s/…/exec" />
        </div>
        <div className="field">
          <label htmlFor="sync-key">Chiave condivisa</label>
          <input id="sync-key" type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder="La chiave impostata in Script Properties" />
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn primary" style={{ flex: 1 }} onClick={save} disabled={s.state === 'syncing'} data-testid="sync-save">
            {connected ? 'Salva e sincronizza' : 'Collega e sincronizza'}
          </button>
          {connected && (
            <button className="btn ghost" style={{ flex: 1 }} onClick={now} disabled={s.state === 'syncing'} data-testid="sync-now">Sincronizza ora</button>
          )}
        </div>
        {connected && (
          <p className={`sync-line is-${s.state}`} role="status" data-testid="sync-status">
            {label}
            {s.state === 'idle' && s.lastSync ? ` · ultima sync ${fmtDateTime(s.lastSync)}` : ''}
            {s.state === 'error' && s.error ? `: ${s.error}` : ''}
            {s.state === 'offline' ? ' · le modifiche verranno inviate al ritorno online' : ''}
          </p>
        )}
        {msg && <p className="disclaimer" role="status" data-testid="sync-msg">{msg}</p>}
        {connected && (confirmOff ? (
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <button className="btn ghost" style={{ flex: 1 }} onClick={() => setConfirmOff(false)}>Annulla</button>
            <button className="btn danger-ghost" style={{ flex: 1 }} onClick={disconnect} data-testid="sync-off-confirm">Scollega</button>
          </div>
        ) : (
          <button className="btn danger-ghost block" style={{ marginTop: 10 }} onClick={() => setConfirmOff(true)} data-testid="sync-off">Scollega il foglio</button>
        ))}
      </div>
    </>
  );
}
