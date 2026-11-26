// Sincronizzazione facoltativa con un Google Sheet tramite una web app di Apps Script.
// Cassetto resta "local-first": IndexedDB è la fonte primaria e tutto funziona offline.
// URL e chiave stanno SOLO in localStorage di questo dispositivo (mai nei backup).
import { applyRemoteChanges, readForSync, setChangeListener } from './db.js';
import { SYNC_API, buildOutgoing, countChanges, parseScriptUrl, planApply } from './syncCore.js';

const CFG_KEY = 'cassetto-sync';
const LAST_KEY = 'cassetto-sync-last';
const DEBOUNCE_MS = 2500;
const TIMEOUT_MS = 30000;

export function getSyncConfig() {
  try {
    const c = JSON.parse(localStorage.getItem(CFG_KEY) || 'null');
    return c && c.url && c.key ? { url: String(c.url), key: String(c.key) } : null;
  } catch {
    return null;
  }
}

export function saveSyncConfig({ url, key }) {
  const parsed = parseScriptUrl(url);
  if (!parsed.ok) return parsed;
  const k = String(key || '').trim();
  if (k.length < 8) return { ok: false, error: 'La chiave deve avere almeno 8 caratteri (la stessa impostata in Script Properties).' };
  localStorage.setItem(CFG_KEY, JSON.stringify({ url: parsed.url, key: k }));
  return { ok: true };
}

export function clearSyncConfig() {
  localStorage.removeItem(CFG_KEY);
  localStorage.removeItem(LAST_KEY);
  setState({ state: 'off', error: '', lastSync: null });
}

const initialState = () => ({
  state: getSyncConfig() ? (typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'idle') : 'off',
  lastSync: (() => {
    try {
      return localStorage.getItem(LAST_KEY) || null;
    } catch {
      return null;
    }
  })(),
  error: '',
});

let status = initialState();
const listeners = new Set();
const appliedHandlers = new Set();

function setState(patch) {
  status = { ...status, ...patch };
  listeners.forEach((fn) => fn(status));
}
export const getSyncStatus = () => status;
export function subscribeSync(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
/** Chiamata dopo che la sync ha scritto dati locali (per ricaricare la UI). */
export function onSyncApplied(fn) {
  appliedHandlers.add(fn);
  return () => appliedHandlers.delete(fn);
}

/** Traduce gli errori di rete/server in messaggi comprensibili. */
export function describeError(err) {
  if (err?.userMessage) return err.userMessage;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'Sei offline: riproverò appena torna la connessione.';
  if (err?.name === 'AbortError') return 'Il foglio non ha risposto in tempo. Riprova tra poco.';
  return 'Impossibile raggiungere il foglio Google. Controlla la connessione e che l\'accesso della web app sia «Chiunque».';
}
const userError = (m) => Object.assign(new Error(m), { userMessage: m });

/** Una richiesta alla web app: POST text/plain (niente preflight CORS), redirect seguiti. */
export async function callScript(cfg, body, fetchImpl = globalThis.fetch.bind(globalThis)) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetchImpl(cfg.url, {
      method: 'POST',
      redirect: 'follow',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ api: SYNC_API, key: cfg.key, ...body }),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw userError(`Il foglio ha risposto con un errore (${res.status}). Ripubblica la web app e riprova.`);
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw userError('La risposta non arriva dallo script: controlla l\'URL e che la web app sia pubblicata con accesso «Chiunque».');
  }
  if (!data || data.ok !== true) throw userError(data?.error ? String(data.error) : 'Il foglio ha rifiutato la richiesta.');
  if (!Array.isArray(data.bonds) || !Array.isArray(data.portfolios)) throw userError('Risposta dello script non valida. Aggiorna il codice incollato in Apps Script.');
  return data;
}

let running = null;
let rerun = false;
let timer = null;

/** Sincronizza adesso. Ritorna {ok, changed} oppure {ok:false, error}. Una sola alla volta. */
export async function syncNow({ fetchImpl } = {}) {
  const cfg = getSyncConfig();
  if (!cfg) return { ok: false, error: 'Sincronizzazione non configurata.' };
  if (running) {
    rerun = true;
    return running;
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    setState({ state: 'offline', error: '' });
    return { ok: false, offline: true, error: describeError(null) };
  }
  running = (async () => {
    setState({ state: 'syncing', error: '' });
    try {
      const local = await readForSync();
      const out = buildOutgoing(local);
      const data = await callScript(cfg, { action: 'sync', bonds: out.bonds, portfolios: out.portfolios }, fetchImpl);
      // Rileggiamo: l'utente può aver modificato mentre aspettavamo la risposta.
      const fresh = await readForSync();
      const plan = planApply(fresh, data);
      const changed = countChanges(plan);
      if (changed) {
        await applyRemoteChanges(plan);
        appliedHandlers.forEach((fn) => Promise.resolve(fn()).catch(() => {}));
      }
      const at = new Date().toISOString();
      try {
        localStorage.setItem(LAST_KEY, at);
      } catch {
        /* storage pieno: lo stato resta valido in memoria */
      }
      setState({ state: 'idle', lastSync: at, error: '' });
      return { ok: true, changed };
    } catch (err) {
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
      const msg = describeError(err);
      setState({ state: offline ? 'offline' : 'error', error: offline ? '' : msg });
      return { ok: false, offline, error: msg };
    } finally {
      running = null;
      if (rerun) {
        rerun = false;
        scheduleSync(500);
      }
    }
  })();
  return running;
}

/** Sync con attesa (debounce): usata dopo le modifiche locali. */
export function scheduleSync(delay = DEBOUNCE_MS) {
  if (!getSyncConfig()) return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    syncNow().catch(() => {});
  }, delay);
}

let started = false;
/** Avvia i trigger automatici: all'apertura, al ritorno online, dopo le modifiche. */
export function startAutoSync() {
  if (started) return;
  started = true;
  setChangeListener(() => scheduleSync());
  window.addEventListener('online', () => {
    if (getSyncConfig()) setState({ state: status.state === 'offline' ? 'idle' : status.state });
    scheduleSync(300);
  });
  window.addEventListener('offline', () => {
    if (getSyncConfig()) setState({ state: 'offline', error: '' });
  });
  scheduleSync(300);
}

/** Dopo aver salvato la configurazione: aggiorna lo stato e sincronizza subito. */
export function configChanged() {
  setState(initialState());
  return syncNow();
}
