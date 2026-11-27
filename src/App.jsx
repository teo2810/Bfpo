import { useEffect, useState, useCallback } from 'react';
import TabBar from './components/TabBar.jsx';
import ActionSheet from './components/ActionSheet.jsx';
import { WalletIcon, GearIcon } from './components/icons.jsx';
import Scadenze from './screens/Scadenze.jsx';
import Disclaimer from './components/Disclaimer.jsx';
import Home from './screens/Home.jsx';
import Portfolios from './screens/Portfolios.jsx';
import Settings from './screens/Settings.jsx';
import Bond from './screens/Bond.jsx';
import AddBond from './screens/AddBond.jsx';
import { listBonds, listPortfolios, getMeta, setMeta, isEmpty, deleteDemoData } from './lib/db.js';
import { buildBackupPayload, exportBackup, downloadBlob } from './lib/backup.js';
import { seedDemoData } from './lib/seed.js';
import { runReminderCheck } from './lib/reminders.js';
import ErrorScreen from './components/ErrorScreen.jsx';
import SyncChip from './components/SyncChip.jsx';
import { startAutoSync, onSyncApplied } from './lib/sync.js';
import './styles/dock.css';

const THEME_KEY = 'cassetto-theme';
const NO_PORTFOLIO = '__none';
const SECTIONS = [
  { key: 'portafogli', label: 'Portafogli', Icon: WalletIcon },
  { key: 'impostazioni', label: 'Impostazioni', Icon: GearIcon },
];

function syncThemeColor(t) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', t === 'dark' ? '#161513' : '#F6F6F4');
}

function NotFound({ onBack }) {
  return (
    <div className="screen screen-enter">
      <div className="empty card">
        <div className="icon">🔎</div>
        <p>Questo buono non esiste più.</p>
        <button className="btn primary" style={{ marginTop: 14, width: 'auto' }} onClick={onBack}>Torna alla Home</button>
      </div>
    </div>
  );
}

export default function App() {
  const [theme, setThemeState] = useState(() => localStorage.getItem(THEME_KEY) || 'light');
  const [ready, setReady] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [bonds, setBonds] = useState([]);
  const [portfolios, setPortfolios] = useState([]);
  const [demoActive, setDemoActive] = useState(false);
  const [lastOpenedPrevious, setLastOpenedPrevious] = useState(null);

  const [activeTab, setActiveTab] = useState('home');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [createPortfolio, setCreatePortfolio] = useState(0);
  const [stack, setStack] = useState([]); // {name, params}

  const applyTheme = useCallback((t) => {
    setThemeState(t);
    localStorage.setItem(THEME_KEY, t);
    document.documentElement.setAttribute('data-theme', t);
    syncThemeColor(t);
    setMeta('theme', t);
  }, []);

  const reloadData = useCallback(async () => {
    const [b, p, demoFlag] = await Promise.all([listBonds(), listPortfolios(), getMeta('demoSeeded', false)]);
    setBonds(b);
    setPortfolios(p);
    setDemoActive(!!demoFlag);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    syncThemeColor(theme);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [initError, setInitError] = useState(null);
  const [initAttempt, setInitAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const prevOpened = await getMeta('lastOpened', null);
        if (!alive) return;
        setLastOpenedPrevious(prevOpened);

        const accepted = await getMeta('disclaimerAccepted', false);
        if (!alive) return;
        setShowDisclaimer(!accepted);

        const seedChecked = await getMeta('seedChecked', false);
        if (!seedChecked) {
          if (await isEmpty()) await seedDemoData();
          await setMeta('seedChecked', true);
        }

        await reloadData();
        if (!alive) return;
        setInitError(null);
        setReady(true);
        startAutoSync(); // facoltativa: parte solo se l'utente ha configurato il foglio
      } catch (err) {
        console.warn('Cassetto: avvio non riuscito', err);
        if (alive) setInitError(err);
        return;
      }
      // I promemoria sono best-effort: un errore qui non deve impedire l'avvio.
      runReminderCheck().catch((err) => console.warn('Cassetto: promemoria non verificati', err));
    })();
    return () => {
      alive = false;
    };
  }, [reloadData, initAttempt]);

  useEffect(() => onSyncApplied(reloadData), [reloadData]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') runReminderCheck().catch(() => {});
    };
    document.addEventListener('visibilitychange', onVisible);
    const onMessage = (e) => {
      if (e.data?.type === 'PERIODIC_SYNC') runReminderCheck().catch(() => {});
    };
    navigator.serviceWorker?.addEventListener?.('message', onMessage);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      navigator.serviceWorker?.removeEventListener?.('message', onMessage);
    };
  }, []);

  const push = (name, params = {}) => setStack((s) => [...s, { name, params }]);
  const pop = () => setStack((s) => s.slice(0, -1));
  const popAll = () => setStack([]);

  const handleAcceptDisclaimer = async () => {
    await setMeta('disclaimerAccepted', true);
    setShowDisclaimer(false);
  };

  const handleStartFresh = async () => {
    await deleteDemoData();
    await reloadData();
  };

  const top = stack[stack.length - 1];
  const showDock = !top;

  const showToast = (m) => {
    setToast(m);
    setTimeout(() => setToast(''), 3500);
  };
  const goSection = (key, anchor) => {
    popAll();
    setActiveTab(key);
    if (anchor) setTimeout(() => document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    else window.scrollTo(0, 0);
  };
  const pickAction = async (key) => {
    setSheetOpen(false);
    if (key === 'add') push('add');
    else if (key === 'scan') push('add', { scan: true });
    else if (key === 'import') goSection('impostazioni', 'sezione-backup');
    else if (key === 'reminders') goSection('impostazioni', 'sezione-notifiche');
    else if (key === 'portfolio') {
      goSection('portafogli');
      setCreatePortfolio((n) => n + 1);
    } else if (key === 'export') {
      try {
        const payload = await buildBackupPayload({ bonds, portfolios, meta: { theme } });
        downloadBlob(await exportBackup(payload, null), `cassetto-backup-${new Date().toISOString().slice(0, 10)}.json`);
        await setMeta('lastExportAt', payload.exportedAt);
        showToast(`Esportati ${payload.bonds.length} buoni e ${payload.portfolios.length} portafogli.`);
      } catch {
        showToast('Export non riuscito: riprova dalle Impostazioni.');
      }
    }
  };

  let body = null;
  if (top?.name === 'bond') {
    const bond = bonds.find((b) => b.id === top.params.id);
    body = bond ? (
      <Bond
        bond={bond}
        portfolios={portfolios}
        onBack={pop}
        onEdit={(id) => push('edit', { id })}
        onDeleted={() => {
          pop();
          reloadData();
        }}
      />
    ) : (
      <NotFound onBack={popAll} />
    );
  } else if (top?.name === 'add') {
    body = (
      <AddBond
        portfolios={portfolios}
        defaultPortfolioId={top.params.portafoglioId}
        autoScan={!!top.params.scan}
        onBack={pop}
        onSaved={async (id) => {
          await reloadData();
          setStack((s) => [...s.slice(0, -1), { name: 'bond', params: { id } }]);
        }}
      />
    );
  } else if (top?.name === 'edit') {
    const existing = bonds.find((b) => b.id === top.params.id);
    body = !existing ? (
      <NotFound onBack={popAll} />
    ) : (
      <AddBond
        existing={existing}
        portfolios={portfolios}
        onBack={pop}
        onSaved={async () => {
          await reloadData();
          pop();
        }}
      />
    );
  } else if (top?.name === 'portfolioDetail') {
    const none = top.params.id === NO_PORTFOLIO;
    const p = none ? null : portfolios.find((pp) => pp.id === top.params.id);
    const filtered = bonds.filter((b) => (none ? !b.portafoglioId || !portfolios.some((pp) => pp.id === b.portafoglioId) : b.portafoglioId === top.params.id));
    body = (
      <Home
        bonds={filtered}
        portfolios={portfolios}
        lastOpenedPrevious={null}
        onOpenBond={(id) => push('bond', { id })}
        onGoAdd={() => push('add', { portafoglioId: p?.id })}
        titleOverride={none ? 'Senza portafoglio' : p?.nome || 'Portafoglio'}
        subtitleOverride={none ? 'Buoni non assegnati a un portafoglio.' : 'Buoni di questo portafoglio.'}
        onBack={pop}
      />
    );
  } else if (activeTab === 'home') {
    body = (
      <Home
        bonds={bonds}
        portfolios={portfolios}
        lastOpenedPrevious={lastOpenedPrevious}
        onOpenBond={(id) => push('bond', { id })}
        onGoAdd={() => push('add')}
        demoActive={demoActive}
        onStartFresh={handleStartFresh}
      />
    );
  } else if (activeTab === 'scadenze') {
    body = <Scadenze bonds={bonds} onOpenBond={(id) => push('bond', { id })} onGoAdd={() => push('add')} />;
  } else if (activeTab === 'portafogli') {
    body = (
      <Portfolios
        startCreating={createPortfolio}
        bonds={bonds}
        portfolios={portfolios}
        onReload={reloadData}
        onOpenPortfolio={(id) => push('portfolioDetail', { id: id ?? NO_PORTFOLIO })}
      />
    );
  } else if (activeTab === 'impostazioni') {
    body = (
      <Settings
        bonds={bonds}
        portfolios={portfolios}
        theme={theme}
        onThemeChange={applyTheme}
        onDataChanged={reloadData}
      />
    );
  }

  if (initError) {
    return (
      <div className="app" data-theme={theme} data-sw="cassetto-v12">
        <ErrorScreen error={initError} onRetry={() => { setInitError(null); setInitAttempt((n) => n + 1); }} />
      </div>
    );
  }
  if (!ready) {
    return (
      <div className="app" data-theme={theme} data-sw="cassetto-v12">
        <div className="boot" aria-busy="true" aria-label="Caricamento">Caricamento…</div>
      </div>
    );
  }

  return (
    <div className="app" data-theme={theme} data-sw="cassetto-v12">
      {showDock && (
        <div className="appbar">
          <button className="brand" onClick={() => goSection('home')} aria-label="Cassetto, vai ai buoni">
            <span className="brand-mark" aria-hidden="true" />
            Cassetto
          </button>
          <SyncChip onClick={() => goSection('impostazioni', 'sezione-sync')} />
          <div className="appbar-actions">
            {SECTIONS.map(({ key, label, Icon }) => (
              <button
                key={key}
                className={`icon-btn${activeTab === key ? ' active' : ''}`}
                aria-label={label}
                aria-current={activeTab === key ? 'page' : undefined}
                onClick={() => goSection(key)}
              >
                <Icon />
              </button>
            ))}
          </div>
        </div>
      )}
      {body}
      {showDock && (
        <TabBar
          active={activeTab}
          onChange={(key) => goSection(key)}
          onAdd={() => setSheetOpen(true)}
        />
      )}
      {sheetOpen && <ActionSheet onClose={() => setSheetOpen(false)} onPick={pickAction} />}
      {toast && <div className="toast" role="status">{toast}</div>}
      {showDisclaimer && <Disclaimer onAccept={handleAcceptDisclaimer} />}
    </div>
  );
}
