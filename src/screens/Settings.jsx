import { useEffect, useRef, useState } from 'react';
import { clearAll, replaceAllData, setMeta } from '../lib/db.js';
import { buildBackupPayload, exportBackup, downloadBlob, parseBackupFile, emptyImportWouldWipe } from '../lib/backup.js';
import { portfolioToICS, downloadICS } from '../lib/ics.js';
import { requestNotificationPermission, tryRegisterPeriodicSync } from '../lib/reminders.js';

export default function Settings({ bonds, portfolios, theme, onThemeChange, onDataChanged }) {
  const [notifStatus, setNotifStatus] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );
  const [periodicSyncOn, setPeriodicSyncOn] = useState(false);
  const [exportPassword, setExportPassword] = useState('');
  const [importPassword, setImportPassword] = useState('');
  const [importMsg, setImportMsg] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [pendingImport, setPendingImport] = useState(null);
  const [notifMsg, setNotifMsg] = useState('');
  const [exportMsg, setExportMsg] = useState('');
  const fileRef = useRef(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const reg = await navigator.serviceWorker?.getRegistration?.();
        const tags = reg?.periodicSync ? await reg.periodicSync.getTags() : [];
        if (alive) setPeriodicSyncOn(tags.includes('cassetto-check'));
      } catch {
        /* non supportato */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const handleNotifToggle = async () => {
    if (notifStatus === 'unsupported') {
      setNotifMsg('Questo browser non supporta le notifiche: usa l\'export .ics nel calendario.');
      return;
    }
    if (notifStatus === 'granted') {
      setNotifMsg('Le notifiche sono già attive. Per disattivarle usa le impostazioni del sito nel browser.');
      return;
    }
    if (notifStatus === 'denied') {
      setNotifMsg('Il browser ha bloccato le notifiche: riabilitale dalle impostazioni del sito.');
      return;
    }
    const res = await requestNotificationPermission();
    setNotifMsg(res === 'granted' ? 'Notifiche attivate.' : 'Permesso non concesso.');
    setNotifStatus(res);
    if (res === 'granted') {
      const ok = await tryRegisterPeriodicSync();
      setPeriodicSyncOn(ok);
    }
  };

  const handleExport = async () => {
    const payload = await buildBackupPayload({ bonds, portfolios, meta: { theme } });
    const blob = await exportBackup(payload, exportPassword || null);
    downloadBlob(blob, `cassetto-backup-${new Date().toISOString().slice(0, 10)}.json`);
    await setMeta('lastExportAt', payload.exportedAt);
    setExportMsg(
      `Esportati ${payload.bonds.length} buoni e ${payload.portfolios.length} portafogli${exportPassword ? ' (file cifrato)' : ''}.` +
        (bonds.some((b) => b.isDemo) ? ' I dati dimostrativi non vengono inclusi.' : '')
    );
  };

  const applyImport = async (data, { allowEmpty = false } = {}) => {
    if (!data.bonds.length && !allowEmpty) {
      if (emptyImportWouldWipe(data, { bonds, portfolios })) {
        setPendingImport(data);
        setImportMsg('Questo backup non contiene buoni. Importarlo cancellerebbe i dati già presenti su questo dispositivo.');
        return;
      }
      setPendingImport(null);
      setImportMsg('Il backup non contiene buoni: niente da importare.');
      return;
    }
    await replaceAllData({ bonds: data.bonds, portfolios: data.portfolios || [] });
    await setMeta('demoSeeded', false);
    await setMeta('seedChecked', true);
    if (data.meta?.theme) onThemeChange(data.meta.theme);
    setImportMsg(
      data.bonds.length
        ? `Importati ${data.bonds.length} buoni e ${data.portfolios?.length || 0} portafogli.`
        : 'Dati sostituiti: nessun buono nel backup.'
    );
    setPendingImport(null);
    await onDataChanged();
  };

  const handleImportClick = () => fileRef.current?.click();

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const data = await parseBackupFile(text, importPassword || null);
      if (!data.bonds.length) {
        await applyImport(data);
        return;
      }
      const hasUserData = bonds.some((b) => !b.isDemo) || portfolios.some((p) => !p.isDemo);
      if (hasUserData) {
        setPendingImport(data);
        setImportMsg('Il dispositivo ha già dei buoni tuoi. Conferma per sostituirli con il backup.');
        return;
      }
      await applyImport(data);
    } catch (err) {
      setPendingImport(null);
      setImportMsg(err.message || 'Import non riuscito.');
    }
  };

  const [icsMsg, setIcsMsg] = useState('');
  const handleGlobalIcs = () => {
    const withDates = bonds.filter((b) => b.dataScadenza || b.dataPrescrizione);
    if (withDates.length === 0) {
      setIcsMsg('Nessun buono con date di scadenza o prescrizione da esportare.');
      return;
    }
    downloadICS(portfolioToICS(withDates, 'Tutti i buoni'), 'cassetto-tutti-i-buoni');
    setIcsMsg(`Esportati i promemoria di ${withDates.length === 1 ? '1 buono' : `${withDates.length} buoni`}.`);
  };

  const handleReset = async () => {
    await clearAll();
    // Preserve internal flags so demo does not reseed and disclaimer does not reappear.
    await setMeta('seedChecked', true);
    await setMeta('disclaimerAccepted', true);
    await setMeta('demoSeeded', false);
    await onDataChanged();
    setConfirmReset(false);
    setImportMsg('');
    setPendingImport(null);
  };

  return (
    <div className="screen screen-enter form-narrow">
      <p className="eyebrow">Cassetto</p>
      <h1 className="title">Impostazioni</h1>
      <p className="subtitle">Tema, notifiche e backup dei tuoi dati.</p>

      <p className="section-title">Aspetto</p>
      <div className="card">
        <div className="switch-row">
          <div>
            <div className="label">Tema chiaro</div>
            <div className="desc">{theme === 'light' ? 'Carta calda: disattiva per il navy scuro' : 'Navy scuro: attiva per la carta calda'}</div>
          </div>
          <button
            type="button"
            className={`switch${theme === 'light' ? ' on' : ''}`}
            onClick={() => onThemeChange(theme === 'light' ? 'dark' : 'light')}
            role="switch"
            aria-checked={theme === 'light'}
            aria-label="Tema chiaro"
          >
            <span className="knob" />
          </button>
        </div>
      </div>

      <p className="section-title" id="sezione-notifiche">Notifiche</p>
      <div className="card">
        <div className="switch-row">
          <div>
            <div className="label">Promemoria scadenze e prescrizioni</div>
            <div className="desc">
              {notifStatus === 'granted'
                ? periodicSyncOn
                  ? 'Attive, con controllo periodico in background (se supportato dal browser).'
                  : 'Attive quando apri Cassetto. Nessuna sveglia garantita ad app chiusa.'
                : notifStatus === 'denied'
                ? 'Bloccate dal browser: abilitale dalle impostazioni del sito.'
                : notifStatus === 'unsupported'
                ? 'Non supportate da questo browser.'
                : 'Da attivare.'}
            </div>
          </div>
          <button
            type="button"
            className={`switch${notifStatus === 'granted' ? ' on' : ''}`}
            onClick={handleNotifToggle}
            role="switch"
            aria-checked={notifStatus === 'granted'}
            aria-label="Promemoria scadenze e prescrizioni"
          >
            <span className="knob" />
          </button>
        </div>
        {notifMsg && <p className="disclaimer" role="status">{notifMsg}</p>}
      </div>
      <p className="disclaimer">
        I promemoria vengono controllati all'apertura dell'app e, quando il browser lo consente, con
        una sincronizzazione periodica in background. Non simulano una sveglia a Cassetto chiuso.
      </p>

      <p className="section-title">Calendario</p>
      <div className="card">
        <button className="btn ghost block" onClick={handleGlobalIcs}>Esporta tutte le scadenze (.ics)</button>
        {icsMsg && <p className="disclaimer" role="status">{icsMsg}</p>}
      </div>

      <p className="section-title" id="sezione-backup">Backup</p>
      <div className="card">
        <div className="field">
          <label>Password di cifratura (facoltativa)</label>
          <input type="password" value={exportPassword} onChange={(e) => setExportPassword(e.target.value)} placeholder="Lascia vuoto per JSON in chiaro" />
        </div>
        <button className="btn primary" onClick={handleExport}>Esporta backup</button>
        {exportMsg && <p className="disclaimer" role="status">{exportMsg}</p>}
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="field">
          <label>Password (se il backup è cifrato)</label>
          <input type="password" value={importPassword} onChange={(e) => setImportPassword(e.target.value)} placeholder="Facoltativa" />
        </div>
        <button className="btn ghost block" onClick={handleImportClick}>Importa backup</button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={handleImportFile} />
        {pendingImport && (
          <div style={{ marginTop: 12 }}>
            <p style={{ margin: '0 0 12px', fontSize: 14 }}>
              {pendingImport.bonds.length === 0
                ? 'Questo backup non contiene buoni. Importarlo cancellerebbe i dati già presenti su questo dispositivo.'
                : `Sostituire i dati attuali con ${pendingImport.bonds.length} buoni e ${pendingImport.portfolios?.length || 0} portafogli del file?`}
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn ghost" style={{ flex: 1 }} onClick={() => { setPendingImport(null); setImportMsg(''); }}>Annulla</button>
              {pendingImport.bonds.length === 0 ? (
                <button className="btn danger-ghost" style={{ flex: 1 }} onClick={() => applyImport(pendingImport, { allowEmpty: true })}>Sostituisci con vuoto</button>
              ) : (
                <button className="btn danger-ghost" style={{ flex: 1 }} onClick={() => applyImport(pendingImport)}>Sostituisci</button>
              )}
            </div>
          </div>
        )}
        {importMsg && <p className="disclaimer" role="status" style={{ marginTop: 10 }}>{importMsg}</p>}
      </div>
      <p className="disclaimer">
        Senza un export, i dati spariscono se cancelli i dati del sito o disinstalli l'app: Cassetto
        non ha un account né una copia in cloud.
      </p>

      <p className="section-title">Dati</p>
      {confirmReset ? (
        <div className="card">
          <p style={{ margin: '0 0 12px', fontSize: 14 }}>
            Questo cancella definitivamente tutti i buoni e i portafogli da questo dispositivo. Esporta
            un backup prima, se non l'hai già fatto.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn ghost" style={{ flex: 1 }} onClick={() => setConfirmReset(false)}>Annulla</button>
            <button className="btn danger-ghost" style={{ flex: 1 }} onClick={handleReset}>Cancella tutto</button>
          </div>
        </div>
      ) : (
        <button className="btn danger-ghost block" onClick={() => setConfirmReset(true)}>Reimposta Cassetto</button>
      )}

      <p className="section-title">Note legali</p>
      <div className="card">
        <p className="disclaimer" style={{ margin: 0 }}>
          Cassetto non è un servizio di Poste Italiane né fornisce consulenza finanziaria. Ogni valore
          mostrato è una stima calcolata localmente. La fonte di verità resta il titolo cartaceo: per
          importi e condizioni ufficiali verifica sempre in ufficio postale o su poste.it. Per i buoni
          cartacei il diritto al rimborso si prescrive generalmente dopo 10 anni dalla scadenza; i
          titoli dematerializzati non si prescrivono.
        </p>
      </div>
    </div>
  );
}
