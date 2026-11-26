// Logica pura della sincronizzazione con Google Sheet (nessun accesso a rete o database):
// last-write-wins per record sul campo updatedAt, cancellazioni come lapidi ({deleted:true}).
// Lo stesso criterio è replicato in apps-script/Code.gs.
import { normalizeBond, normalizePortfolio } from './normalize.js';

export const SYNC_API = 1;
export const EPOCH = '1970-01-01T00:00:00.000Z';
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export const isValidId = (id) => typeof id === 'string' && ID_RE.test(id);

/** Millisecondi di updatedAt (0 se assente o non valido). */
export function ts(rec) {
  const t = Date.parse(rec?.updatedAt);
  return Number.isFinite(t) ? t : 0;
}

/** true se `remote` deve sostituire `local`: più recente vince; a parità vince la lapide. */
export function remoteWins(local, remote) {
  if (!local) return true;
  const tl = ts(local);
  const tr = ts(remote);
  if (tr !== tl) return tr > tl;
  return !!remote.deleted && !local.deleted;
}

/** Unisce due liste di record (per id) con la regola last-write-wins. */
export function mergeRecords(localList, remoteList) {
  const map = new Map();
  for (const r of localList || []) if (r && r.id != null) map.set(String(r.id), r);
  for (const r of remoteList || []) {
    if (!r || r.id == null) continue;
    const id = String(r.id);
    if (remoteWins(map.get(id), r)) map.set(id, r);
  }
  return [...map.values()];
}

const stamp = (rec) => (typeof rec.updatedAt === 'string' && ts(rec) ? rec.updatedAt : EPOCH);

/** Record in formato di rete: senza lastNotified (stato locale del dispositivo), mai i dati demo. */
export function toWireBond(b) {
  // eslint-disable-next-line no-unused-vars
  const { lastNotified, checklist, ...rest } = b;
  return { ...rest, id: String(b.id), updatedAt: stamp(b) };
}
export function toWirePortfolio(p) {
  return { ...p, id: String(p.id), updatedAt: stamp(p) };
}

const tombList = (map) => Object.entries(map || {}).map(([id, at]) => ({ id, updatedAt: at, deleted: true }));

/** Costruisce il corpo da inviare: record vivi (non demo) + lapidi. */
export function buildOutgoing({ bonds, portfolios, tombs }) {
  const liveB = (bonds || []).filter((b) => !b.isDemo && isValidId(String(b.id))).map(toWireBond);
  const liveP = (portfolios || []).filter((p) => !p.isDemo && isValidId(String(p.id))).map(toWirePortfolio);
  return {
    bonds: mergeRecords(liveB, tombList(tombs?.bonds).filter((t) => isValidId(t.id))),
    portfolios: mergeRecords(liveP, tombList(tombs?.portfolios).filter((t) => isValidId(t.id))),
  };
}

function sanitizeLive(kind, rec) {
  const n = kind === 'bonds' ? normalizeBond(rec) : normalizePortfolio(rec);
  if (!n) return null;
  delete n.deleted;
  n.isDemo = false;
  n.updatedAt = stamp(rec);
  return n;
}

/**
 * Confronta la risposta del server con i dati locali e ritorna cosa applicare localmente.
 * `local` = { bonds, portfolios, tombs } come letto dal database.
 */
export function planApply(local, response) {
  const out = { putBonds: [], delBonds: {}, putPortfolios: [], delPortfolios: {} };
  const plan = (kind, putKey, delKey) => {
    const localMap = new Map();
    for (const r of local[kind] || []) if (!r.isDemo) localMap.set(String(r.id), r);
    for (const [id, at] of Object.entries(local.tombs?.[kind] || {})) {
      const live = localMap.get(id);
      const tomb = { id, updatedAt: at, deleted: true };
      if (!live || remoteWins(live, tomb)) localMap.set(id, tomb);
    }
    for (const r of response[kind] || []) {
      if (!r || !isValidId(String(r.id))) continue;
      const id = String(r.id);
      const cur = localMap.get(id);
      if (!remoteWins(cur, r)) continue;
      if (r.deleted) {
        // Se localmente c'è già la stessa lapide non serve nulla.
        if (cur?.deleted && ts(cur) === ts(r)) continue;
        out[delKey][id] = stamp(r);
      } else {
        const clean = sanitizeLive(kind, r);
        if (clean) out[putKey].push(clean);
      }
    }
  };
  plan('bonds', 'putBonds', 'delBonds');
  plan('portfolios', 'putPortfolios', 'delPortfolios');
  return out;
}

export const countChanges = (p) =>
  p.putBonds.length + p.putPortfolios.length + Object.keys(p.delBonds).length + Object.keys(p.delPortfolios).length;

/** Valida e normalizza l'URL della web app (solo https e solo Google Apps Script). */
export function parseScriptUrl(raw) {
  const text = String(raw || '').trim();
  let u;
  try {
    u = new URL(text);
  } catch {
    return { ok: false, error: 'L\'indirizzo non è valido: incolla l\'URL della web app (finisce con /exec).' };
  }
  if (u.protocol !== 'https:' || u.hostname !== 'script.google.com' || !/^\/macros\/s\/[^/]+\/exec$/.test(u.pathname)) {
    return { ok: false, error: 'Serve l\'URL della web app di Apps Script: https://script.google.com/macros/s/…/exec' };
  }
  u.search = '';
  u.hash = '';
  return { ok: true, url: u.toString() };
}
