import { BondsIcon, CalendarIcon, PlusIcon } from './icons.jsx';

export const TABS = [
  { key: 'home', label: 'Buoni', Icon: BondsIcon },
  { key: 'scadenze', label: 'Scadenze', Icon: CalendarIcon },
];

/**
 * Barra: pillole simmetriche (Buoni, Scadenze, stessa larghezza) e + corallo staccato a destra.
 */
export default function TabBar({ active, onChange, onAdd }) {
  const pill = (tab) => (
    <button
      key={tab.key}
      className={`dock-tab${tab.key === active ? ' active' : ''}`}
      aria-current={tab.key === active ? 'page' : undefined}
      onClick={() => onChange(tab.key)}
    >
      <tab.Icon />
      <span>{tab.label}</span>
    </button>
  );
  return (
    <nav className="dock-layer" aria-label="Navigazione principale">
      <div className="dock">
        <div className="dock-pills">
          {pill(TABS[0])}
          {pill(TABS[1])}
        </div>
        <button className="dock-add" onClick={onAdd} aria-label="Azioni rapide" aria-haspopup="dialog">
          <PlusIcon size={22} />
        </button>
      </div>
    </nav>
  );
}
