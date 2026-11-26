import { listBonds, updateBondNotified, setMeta } from './db.js';
import { daysUntil } from './quote.js';

const THRESHOLDS = [90, 60, 30, 7];

function pickThreshold(days) {
  if (days == null || days < 0) return null;
  // Soglia più piccola ancora non superata (la più stringente raggiunta).
  const reached = THRESHOLDS.filter((t) => days <= t);
  return reached.length ? Math.min(...reached) : null;
}

async function notify(title, body) {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  try {
    if (navigator.serviceWorker?.controller) {
      const reg = await navigator.serviceWorker.ready;
      reg.showNotification(title, { body, icon: 'icons/icon-192.svg' });
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
      dueCount += 1;
      if (already) continue;
      const label = key === 'scadenza' ? 'Scadenza' : 'Prescrizione';
      await notify(
        `${label} tra ${days} giorni`,
        `Buono ${bond.serie || ''} n. ${bond.numero || ''} — controlla Cassetto.`
      );
      await updateBondNotified(bond.id, {
        [key]: { ...(bond.lastNotified?.[key] || {}), [threshold]: true },
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
