import { listBonds, updateBondNotified, setMeta } from './db.js';
import { daysUntil } from './quote.js';

const THRESHOLDS = [7, 30, 60, 90];

/**
 * Soglia più stringente già raggiunta: la più piccola tra quelle >= giorni rimasti.
 * Un `.find` su [90, 60, 30, 7] restituiva sempre 90.
 */
export function pickThreshold(days) {
  if (days == null || days < 0) return undefined;
  return THRESHOLDS.find((t) => days <= t);
}

async function notify(title, body) {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  try {
    if (navigator.serviceWorker?.controller) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, { body, icon: 'icons/icon-192.svg', tag: title + body });
    } else {
      new Notification(title, { body, icon: 'icons/icon-192.svg' });
    }
    if ('setAppBadge' in navigator) navigator.setAppBadge().catch(() => {});
  } catch {
    // best-effort: se il browser nega, ignoriamo silenziosamente.
  }
}

/**
 * Da chiamare all'avvio, su visibilitychange e su periodicsync.
 * Aggiorna lastOpened e invia notifiche best-effort per soglie non ancora notificate.
 * Non pianifica nulla per quando l'app è chiusa: è solo un controllo eseguito quando gira.
 */
export async function runReminderCheck() {
  await setMeta('lastOpened', new Date().toISOString());
  const bonds = await listBonds();
  const now = new Date();
  let dueCount = 0;

  for (const bond of bonds) {
    for (const [field, key] of [
      ['dataScadenza', 'scadenza'],
      ['dataPrescrizione', 'prescrizione'],
    ]) {
      const days = daysUntil(bond[field], now);
      if (days == null) continue;
      const threshold = pickThreshold(days);
      if (!threshold) continue;
      const already = bond.lastNotified?.[key]?.[threshold];
      if (already) continue;
      dueCount += 1;
      const label = key === 'scadenza' ? 'Scadenza' : 'Prescrizione';
      await notify(
        days === 0 ? `${label} oggi` : `${label} tra ${days} ${days === 1 ? 'giorno' : 'giorni'}`,
        `Buono ${bond.serie || ''} n. ${bond.numero || ''} — controlla Cassetto.`.replace(/\s+/g, ' ')
      );
      await updateBondNotified(bond.id, {
        [key]: { ...bond.lastNotified?.[key], [threshold]: true },
      });
    }
  }
  return { dueCount, checkedAt: now.toISOString() };
}

export async function requestNotificationPermission() {
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

export async function tryRegisterPeriodicSync() {
  try {
    const reg = await navigator.serviceWorker?.ready;
    if (!reg || !('periodicSync' in reg)) return false;
    const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
    if (status.state !== 'granted') return false;
    await reg.periodicSync.register('cassetto-check', { minInterval: 24 * 60 * 60 * 1000 });
    return true;
  } catch {
    return false;
  }
}
