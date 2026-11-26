import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { HomeIcon, WalletIcon, ChartIcon, GearIcon } from './icons.jsx';

export const TABS = [
  { key: 'home', label: 'Home', color: 'var(--cyan)', Icon: HomeIcon },
  { key: 'portafogli', label: 'Portafogli', color: 'var(--mint)', Icon: WalletIcon },
  { key: 'grafici', label: 'Grafici', color: 'var(--amber)', Icon: ChartIcon },
  { key: 'impostazioni', label: 'Impostazioni', color: 'var(--coral)', Icon: GearIcon },
];

export default function TabBar({ active, onChange }) {
  const dockRef = useRef(null);
  const tabRefs = useRef([]);
  const [beadLeft, setBeadLeft] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragIndexRef = useRef(TABS.findIndex((t) => t.key === active));
  const suppressClickRef = useRef(false);

  const activeIndex = TABS.findIndex((t) => t.key === active);

  const measure = (index) => {
    const dock = dockRef.current;
    const tab = tabRefs.current[index];
    if (!dock || !tab) return 0;
    const dockRect = dock.getBoundingClientRect();
    const tabRect = tab.getBoundingClientRect();
    const beadWidth = 52;
    return tabRect.left - dockRect.left + tabRect.width / 2 - beadWidth / 2;
  };

  useLayoutEffect(() => {
    if (!dragging) setBeadLeft(measure(activeIndex));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, dragging]);

  useEffect(() => {
    const onResize = () => setBeadLeft(measure(activeIndex));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  const nearestIndex = (clientX) => {
    let best = 0;
    let bestDist = Infinity;
    tabRefs.current.forEach((el, i) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      const center = r.left + r.width / 2;
      const dist = Math.abs(clientX - center);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    return best;
  };

  const onPointerDown = (e) => {
    setDragging(true);
    dockRef.current?.setPointerCapture?.(e.pointerId);
    handlePointerMove(e);
  };

  const handlePointerMove = (e) => {
    const dock = dockRef.current;
    if (!dock) return;
    const dockRect = dock.getBoundingClientRect();
    const beadWidth = 52;
    let left = e.clientX - dockRect.left - beadWidth / 2;
    left = Math.max(6, Math.min(dockRect.width - beadWidth - 6, left));
    setBeadLeft(left);
    dragIndexRef.current = nearestIndex(e.clientX);
  };

  const onPointerMove = (e) => {
    if (!dragging) return;
    handlePointerMove(e);
  };

  const endDrag = () => {
    if (!dragging) return;
    setDragging(false);
    // Il click che segue il pointerup rifarebbe onChange sul tab premuto all'inizio,
    // annullando un drag finito su un altro tab.
    suppressClickRef.current = true;
    setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
    const idx = dragIndexRef.current;
    if (TABS[idx].key !== active) onChange(TABS[idx].key);
    else setBeadLeft(measure(idx));
  };

  const activeColor = TABS[dragging ? dragIndexRef.current : activeIndex]?.color;

  return (
    <div className="dock-layer">
      <div
        className="dock"
        ref={dockRef}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div
          className="bead"
          style={{
            left: beadLeft,
            transition: dragging ? 'background-color 200ms ease' : undefined,
            ['--bead-color']: activeColor,
          }}
        />
        {TABS.map((tab, i) => (
          <button
            key={tab.key}
            ref={(el) => (tabRefs.current[i] = el)}
            className={`dock-tab${tab.key === active ? ' active' : ''}`}
            style={{ ['--tab-color']: tab.color }}
            aria-label={tab.label}
            aria-current={tab.key === active}
            onClick={() => {
              if (suppressClickRef.current) {
                suppressClickRef.current = false;
                return;
              }
              onChange(tab.key);
            }}
            onPointerDown={onPointerDown}
          >
            <tab.Icon />
          </button>
        ))}
      </div>
    </div>
  );
}
