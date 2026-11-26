import { useRef, useState } from 'react';
import { clearAll, replaceAllData, setMeta } from '../lib/db.js';
import { buildBackupPayload, exportBackup, downloadBlob, parseBackupFile } from '../lib/backup.js';
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
  const fileRef = useRef(null);

  const handleNotifToggle = async () => {
    if (notifStatus === 'granted') return;
    const res = await requestNotificationPermission();
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
  };

  const handleImportClick = () => fileRef.current?.click();

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const data = await parseBackupFile(text, importPassword || null);
      await replaceAllData({ bonds: data.bonds, portfolios: data.portfolios || [] });
      if (data.meta?.theme) {
        onThemeChange(data.meta.theme);
      }
      setImportMsg(`Importati ${data.bonds.length} buoni e ${data.portfolios?.length || 0} portafogli.`);
      onDataChanged();
    } catch (err) {
      setImportMsg(err.message || 'Import non riuscito.');
    }
  };

  const handleGlobalIcs = () => {
    downloadICS(portfolioToICS(bonds, 'Tutti i buoni'), 'cassetto-tutti-i-buoni');
  };

  const handleReset = async () => {
    await clearAll();
    // Preserve internal flags so demo does not reseed and disclaimer does not reappear.
    await setMeta('seedChecked', true);
    await setMeta('disclaimerAccepted', true);
    await setMeta('demoSeeded', false);
    onDataChanged();
    setConfirmReset(false);
  };

  return (
    <div className="screen screen-enter">
      <p className="eyebrow">Cassetto</p>
      <h1 className="title">Impostazioni</h1>
      <p className="subtitle">Tema, notifiche e backup dei tuoi dati.</p>

      <p className="section-title">Aspetto</p>
      <div className="card">
        <div className="switch-row">
          <div>
            <div className="label">Tema chiaro</div>
            <div className="desc">Passa da carta calda a navy scuro</div>
          </div>
          <div
            className={`switch${theme === 'light' ? ' on' : ''}`}
            onClick={() => onThemeChange(theme === 'light' ? 'dark' : 'light')}
            role="switch"
            aria-checked={theme === 'light'}
          >
            <div className="knob" />
          </div>
        </div>
      </div>

      <p className="section-title">Notifiche</p>
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
                : 'Da attivare.'}
            </div>
          </div>
          <div
            className={`switch${notifStatus === 'granted' ? ' on' : ''}`}
            onClick={handleNotifToggle}
            role="switch"
            aria-checked={notifStatus === 'granted'}
          >
            <div className="knob" />
          </div>
        </div>
      </div>
      <p className="disclaimer">
        I promemoria vengono controllati all'apertura dell'app e, quando il browser lo consente, con
        una sincronizzazione periodica in background. Non simulano una sveglia a Cassetto chiuso.
      </p>

      <p className="section-title">Calendario</p>
      <button className="btn ghost block" onClick={handleGlobalIcs}>Esporta tutte le scadenze (.ics)</button>

      <p className="section-title">Backup</p>
      <div className="card">
        <div className="field">
          <label>Password di cifratura (facoltativa)</label>
          <input type="password" value={exportPassword} onChange={(e) => setExportPassword(e.target.value)} placeholder="Lascia vuoto per JSON in chiaro" />
        </div>
        <button className="btn primary" onClick={handleExport}>Esporta backup</button>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="field">
          <label>Password (se il backup è cifrato)</label>
          <input type="password" value={importPassword} onChange={(e) => setImportPassword(e.target.value)} placeholder="Facoltativa" />
        </div>
        <button className="btn ghost block" onClick={handleImportClick}>Importa backup</button>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={handleImportFile} />
        {importMsg && <p className="disclaimer" style={{ marginTop: 10 }}>{importMsg}</p>}
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
