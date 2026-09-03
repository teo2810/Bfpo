import { useEffect, useState, useCallback } from 'react';
import TabBar, { TABS } from './components/TabBar.jsx';
import Fab from './components/Fab.jsx';
import Disclaimer from './components/Disclaimer.jsx';
import Home from './screens/Home.jsx';
import Portfolios from './screens/Portfolios.jsx';
import Charts from './screens/Charts.jsx';
import Settings from './screens/Settings.jsx';
import Bond from './screens/Bond.jsx';
import AddBond from './screens/AddBond.jsx';
import { listBonds, listPortfolios, getMeta, setMeta, isEmpty, deleteDemoData } from './lib/db.js';
import { seedDemoData } from './lib/seed.js';
import { runReminderCheck } from './lib/reminders.js';
import './styles/dock.css';

const THEME_KEY = 'cassetto-theme';

export default function App() {
  const [theme, setThemeState] = useState(() => localStorage.getItem(THEME_KEY) || 'dark');
  const [ready, setReady] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [bonds, setBonds] = useState([]);
  const [portfolios, setPortfolios] = useState([]);
  const [demoActive, setDemoActive] = useState(false);
  const [lastOpenedPrevious, setLastOpenedPrevious] = useState(null);

  const [activeTab, setActiveTab] = useState('home');
  const [stack, setStack] = useState([]); // {name, params}

  const applyTheme = useCallback((t) => {
    setThemeState(t);
    localStorage.setItem(THEME_KEY, t);
    document.documentElement.setAttribute('data-theme', t);
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    (async () => {
      const prevOpened = await getMeta('lastOpened', null);
      setLastOpenedPrevious(prevOpened);

      const accepted = await getMeta('disclaimerAccepted', false);
      setShowDisclaimer(!accepted);

      const seedChecked = await getMeta('seedChecked', false);
      if (!seedChecked) {
        if (await isEmpty()) await seedDemoData();
        await setMeta('seedChecked', true);
      }

      await reloadData();
      await runReminderCheck();
      setReady(true);
    })();
  }, [reloadData]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') runReminderCheck();
    };
    document.addEventListener('visibilitychange', onVisible);
    const onMessage = (e) => {
      if (e.data?.type === 'PERIODIC_SYNC') runReminderCheck();
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
  const activeGlow = TABS.find((t) => t.key === activeTab)?.color;

  let body = null;
  if (top?.name === 'bond') {
    const bond = bonds.find((b) => b.id === top.params.id);
    body = bond ? (
      <Bond
        bond={bond}
        portfolios={portfolios}
        onBack={pop}
        onEdit={(id) => {
          pop();
          push('edit', { id });
        }}
        onReload={reloadData}
        onDeleted={() => {
          pop();
          reloadData();
        }}
      />
    ) : null;
  } else if (top?.name === 'add') {
    body = (
      <AddBond
        portfolios={portfolios}
        onBack={pop}
        onSaved={async (id) => {
          await reloadData();
          setStack([{ name: 'bond', params: { id } }]);
        }}
      />
    );
  } else if (top?.name === 'edit') {
    const existing = bonds.find((b) => b.id === top.params.id);
    body = (
      <AddBond
        existing={existing}
        portfolios={portfolios}
        onBack={pop}
        onSaved={async (id) => {
          await reloadData();
          setStack([{ name: 'bond', params: { id } }]);
        }}
      />
    );
  } else if (top?.name === 'portfolioDetail') {
    const p = portfolios.find((pp) => pp.id === top.params.id);
    const filtered = bonds.filter((b) => b.portafoglioId === top.params.id);
    body = (
      <Home
        bonds={filtered}
        portfolios={portfolios}
        lastOpenedPrevious={null}
        onOpenBond={(id) => push('bond', { id })}
        onGoAdd={() => push('add')}
        titleOverride={p?.nome}
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
  } else if (activeTab === 'portafogli') {
    body = (
      <Portfolios
        bonds={bonds}
        portfolios={portfolios}
        onReload={reloadData}
        onOpenPortfolio={(id) => push('portfolioDetail', { id })}
      />
    );
  } else if (activeTab === 'grafici') {
    body = <Charts bonds={bonds} portfolios={portfolios} />;
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

  if (!ready) return null;

  return (
    <div className="app" data-theme={theme}>
      <div className="bg-glow" style={{ ['--glow-color']: activeGlow }} />
      {body}
      {showDock && (
        <>
          <Fab onClick={() => push('add')} />
          <TabBar
            active={activeTab}
            onChange={(key) => {
              popAll();
              setActiveTab(key);
            }}
          />
        </>
      )}
      {showDisclaimer && <Disclaimer onAccept={handleAcceptDisclaimer} />}
    </div>
  );
}
