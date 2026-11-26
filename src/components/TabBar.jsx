import { BondsIcon, CalendarIcon, PlusIcon } from './icons.jsx';

export const TABS = [
  { key: 'home', label: 'Buoni', Icon: BondsIcon },
  { key: 'scadenze', label: 'Scadenze', Icon: CalendarIcon },
];

/**
 * Barra simmetrica: [ Buoni ] [ + ] [ Scadenze ]. Le due pillole hanno larghezza identica
 * (colonne 1fr) e il + è centrato tra le due, della stessa altezza della barra.
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
        {pill(TABS[0])}
        <button className="dock-add" onClick={onAdd} aria-label="Azioni rapide" aria-haspopup="dialog">
          <PlusIcon size={26} />
        </button>
        {pill(TABS[1])}
      </div>
    </nav>
  );
}
