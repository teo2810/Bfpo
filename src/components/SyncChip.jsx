import { useSyncExternalStore } from 'react';
import { getSyncStatus, subscribeSync } from '../lib/sync.js';

const hhmm = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
};

/** Testo breve dello stato di sincronizzazione (null = sync non attiva). */
export function syncLabel(s) {
  if (s.state === 'off') return null;
  if (s.state === 'syncing') return 'Sincronizzazione…';
  if (s.state === 'offline') return 'Offline';
  if (s.state === 'error') return 'Errore di sincronizzazione';
  return s.lastSync ? `Sincronizzato alle ${hhmm(s.lastSync)}` : 'In attesa di sincronizzare';
}

export default function SyncChip({ onClick }) {
  const s = useSyncExternalStore(subscribeSync, getSyncStatus);
  const label = syncLabel(s);
  if (!label) return null;
  return (
    <button className={`sync-chip is-${s.state}`} data-testid="sync-chip" data-state={s.state} onClick={onClick} aria-label={`${label}. Apri le impostazioni di sincronizzazione`}>
      <span className="dot" aria-hidden="true" />
      <span className="txt">{label}</span>
    </button>
  );
}
