import { useEffect, useRef } from 'react';
import { AddDocIcon, ScanIcon, DownloadIcon, UploadIcon, FolderPlusIcon, BellIcon } from './icons.jsx';

export const ACTIONS = [
  { key: 'add', label: 'Aggiungi buono', Icon: AddDocIcon },
  { key: 'scan', label: 'Scansiona', Icon: ScanIcon },
  { key: 'import', label: 'Importa backup', Icon: DownloadIcon },
  { key: 'export', label: 'Esporta', Icon: UploadIcon },
  { key: 'portfolio', label: 'Nuovo portafoglio', Icon: FolderPlusIcon },
  { key: 'reminders', label: 'Promemoria', Icon: BellIcon },
];

export default function ActionSheet({ onClose, onPick }) {
  const first = useRef(null);
  useEffect(() => {
    first.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet action-sheet" role="dialog" aria-modal="true" aria-label="Aggiungi" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" aria-hidden="true" />
        <h2 className="sheet-title">Aggiungi</h2>
        <div className="action-grid">
          {ACTIONS.map(({ key, label, Icon }, i) => (
            <button key={key} ref={i === 0 ? first : undefined} className="action" onClick={() => onPick(key)}>
              <span className={`action-tile t${i % 3}`}><Icon /></span>
              <span className="action-label">{label}</span>
            </button>
          ))}
        </div>
        <button className="btn ghost block" style={{ marginTop: 14 }} onClick={onClose}>Chiudi</button>
      </div>
    </div>
  );
}
