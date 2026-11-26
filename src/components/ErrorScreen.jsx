import { useState } from 'react';
import { dumpRaw, deleteDatabase } from '../lib/db.js';
import { downloadBlob } from '../lib/backup.js';

/** Svuota cache e service worker: rimedio a una versione vecchia rimasta in cache. */
export async function clearAppCaches() {
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations?.()) || [];
    await Promise.all(regs.map((r) => r.unregister()));
  } catch {
    /* ignorato */
  }
  try {
    const keys = (await globalThis.caches?.keys?.()) || [];
    await Promise.all(keys.map((k) => caches.delete(k)));
  } catch {
    /* ignorato */
  }
}

export default function ErrorScreen({ error, onRetry }) {
  const [msg, setMsg] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const blocked = error?.code === 'blocked';

  const handleRetry = async () => {
    setMsg('');
    if (onRetry) onRetry();
    else window.location.reload();
  };

  const handleRepair = async () => {
    await clearAppCaches();
    window.location.reload();
  };

  const handleExport = async () => {
    try {
      const data = await dumpRaw();
      const payload = { app: 'cassetto', version: 1, exportedAt: new Date().toISOString(), recovery: true, ...data };
      downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), `cassetto-recupero-${new Date().toISOString().slice(0, 10)}.json`);
      setMsg(`Esportati ${data.bonds.length} buoni e ${data.portfolios.length} portafogli.`);
    } catch (e) {
      setMsg(`Export non riuscito: ${e?.message || e}`);
    }
  };

  const handleReset = async () => {
    try {
      await deleteDatabase();
      localStorage.removeItem('cassetto-theme');
      await clearAppCaches();
      window.location.reload();
    } catch (e) {
      setMsg(`Reimpostazione non riuscita: ${e?.message || e}`);
    }
  };

  return (
    <div className="screen screen-enter form-narrow" role="alert">
      <p className="eyebrow">Cassetto</p>
      <h1 className="title">{blocked ? 'Chiudi le altre schede' : 'Qualcosa è andato storto'}</h1>
      <p className="subtitle">
        {blocked
          ? error.message
          : 'Cassetto non è riuscito ad avviarsi. I tuoi dati restano sul dispositivo: puoi riprovare, esportarli o reimpostare l\'app.'}
      </p>
      {!blocked && error?.message && <p className="disclaimer" data-testid="error-detail">Dettaglio: {error.message}</p>}
      <div className="card" style={{ marginTop: 16, display: 'grid', gap: 10 }}>
        <button className="btn primary" onClick={handleRetry}>Riprova</button>
        <button className="btn ghost block" onClick={handleRepair}>Aggiorna l'app (svuota la cache)</button>
        {!blocked && <button className="btn ghost block" onClick={handleExport}>Esporta backup di emergenza</button>}
        {!blocked &&
          (confirmReset ? (
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn ghost" style={{ flex: 1 }} onClick={() => setConfirmReset(false)}>Annulla</button>
              <button className="btn danger-ghost" style={{ flex: 1 }} onClick={handleReset}>Cancella tutto</button>
            </div>
          ) : (
            <button className="btn danger-ghost block" onClick={() => setConfirmReset(true)}>Reimposta Cassetto</button>
          ))}
        {confirmReset && <p className="disclaimer">Cancella definitivamente buoni e portafogli da questo dispositivo. Esporta prima il backup di emergenza.</p>}
        {msg && <p className="disclaimer" role="status">{msg}</p>}
      </div>
    </div>
  );
}
