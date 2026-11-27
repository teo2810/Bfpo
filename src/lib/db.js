import { openDB } from 'idb';
import { normalizeBonds, normalizePortfolios } from './normalize.js';

const DB_NAME = 'cassetto-db';
const DB_VERSION = 2;

let dbPromise = null;

export class DBOpenError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const OPEN_TIMEOUT_MS = 8000;

/**
 * Apre IndexedDB senza mai restare appeso: se un'altra scheda con una versione vecchia tiene
 * il database aperto (upgrade "blocked") o l'apertura non risponde, rifiuta con un errore
 * leggibile invece di lasciare la pagina bianca. Se invece siamo noi a bloccare una versione
 * più nuova aperta in un'altra scheda, chiudiamo la connessione per lasciarla procedere.
 */
export function getDB() {
  if (!dbPromise) {
    let failOpen = () => {};
    const blockedError = () =>
      new DBOpenError('blocked', 'Un\'altra scheda o finestra di Cassetto con una versione precedente è ancora aperta e blocca l\'aggiornamento dei dati. Chiudila e premi «Riprova».');
    const opening = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, tx) {
        if (!db.objectStoreNames.contains('bonds')) {
          const bonds = db.createObjectStore('bonds', { keyPath: 'id' });
          bonds.createIndex('portafoglioId', 'portafoglioId');
          bonds.createIndex('dataScadenza', 'dataScadenza');
          bonds.createIndex('dataPrescrizione', 'dataPrescrizione');
        } else if (oldVersion < 2) {
          const bonds = tx.objectStore('bonds');
          if (bonds.indexNames.contains('portfolioId')) bonds.deleteIndex('portfolioId');
          if (!bonds.indexNames.contains('portafoglioId')) {
            bonds.createIndex('portafoglioId', 'portafoglioId');
          }
        }
        if (!db.objectStoreNames.contains('portfolios')) {
          db.createObjectStore('portfolios', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      },
      blocked() {
        setTimeout(() => failOpen(blockedError()), 1500);
      },
      blocking() {
        // Una versione più nuova vuole aggiornare il database: liberalo.
        opening.then((db) => db.close()).catch(() => {});
        dbPromise = null;
      },
      terminated() {
        dbPromise = null;
      },
    });
    const timeout = new Promise((_, reject) => {
      failOpen = reject;
      setTimeout(() => reject(new DBOpenError('timeout', 'Il database locale non risponde.')), OPEN_TIMEOUT_MS);
    });
    const current = Promise.race([opening, timeout]).catch((err) => {
      if (dbPromise === current) dbPromise = null;
      if (err instanceof DBOpenError) throw err;
      throw new DBOpenError('open', `Impossibile aprire i dati locali: ${err?.message || err}`);
    });
    dbPromise = current;
  }
  return dbPromise;
}

// ---------- sync: cambi locali e lapidi ----------
// Le cancellazioni restano come "lapidi" ({id: updatedAt}) nello store meta: servono alla
// sincronizzazione per propagare l'eliminazione. Non finiscono nei backup.
let changeListener = null;
/** Registra la funzione chiamata dopo ogni modifica locale (non quelle applicate dalla sync). */
export function setChangeListener(fn) {
  changeListener = fn;
}
function notifyChange() {
  try {
    changeListener?.();
  } catch {
    /* la sync non deve mai rompere una modifica locale */
  }
}
const TOMB_KEY = 'syncTombstones';
async function readTombs(db) {
  const row = await db.get('meta', TOMB_KEY);
  const v = row?.value;
  return { bonds: { ...v?.bonds }, portfolios: { ...v?.portfolios } };
}
async function writeTombs(db, t) {
  await db.put('meta', { key: TOMB_KEY, value: t });
}
export async function getTombstones() {
  const db = await getDB();
  return readTombs(db);
}

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

// ---------- bonds ----------
export async function listBonds() {
  const db = await getDB();
  return normalizeBonds(await db.getAll('bonds'));
}

export async function getBond(id) {
  const db = await getDB();
  return db.get('bonds', id);
}

export async function saveBond(bond) {
  const db = await getDB();
  const now = new Date().toISOString();
  const rest = { ...bond };
  delete rest.checklist;
  const toSave = {
    lastNotified: { scadenza: {}, prescrizione: {} },
    ...rest,
    id: bond.id || uid(),
    createdAt: bond.createdAt || now,
    updatedAt: now,
  };
  delete toSave.checklist;
  await db.put('bonds', toSave);
  notifyChange();
  return toSave;
}

export async function deleteBond(id) {
  const db = await getDB();
  const old = await db.get('bonds', id);
  await db.delete('bonds', id);
  if (old && !old.isDemo) {
    const t = await readTombs(db);
    t.bonds[id] = new Date().toISOString();
    await writeTombs(db, t);
    notifyChange();
  }
}

export async function updateBondNotified(id, patch) {
  const db = await getDB();
  const bond = await db.get('bonds', id);
  if (!bond) return;
  bond.lastNotified = { ...bond.lastNotified, ...patch };
  await db.put('bonds', bond);
}

// ---------- portfolios ----------
export async function listPortfolios() {
  const db = await getDB();
  return normalizePortfolios(await db.getAll('portfolios'));
}

export async function savePortfolio(p) {
  const db = await getDB();
  const toSave = {
    id: p.id || uid(),
    nome: p.nome,
    colore: p.colore || 'cyan',
    isDemo: !!p.isDemo,
    updatedAt: new Date().toISOString(),
  };
  await db.put('portfolios', toSave);
  notifyChange();
  return toSave;
}

export async function assignBondsToPortfolio(ids, portafoglioId) {
  const db = await getDB();
  const now = new Date().toISOString();
  const pid = portafoglioId || null;
  for (const id of ids) {
    const b = await db.get('bonds', id);
    if (!b) continue;
    await db.put('bonds', { ...b, portafoglioId: pid, updatedAt: now });
  }
  notifyChange();
}

export async function deletePortfolio(id) {
  const db = await getDB();
  const old = await db.get('portfolios', id);
  await db.delete('portfolios', id);
  if (old && !old.isDemo) {
    const t = await readTombs(db);
    t.portfolios[id] = new Date().toISOString();
    await writeTombs(db, t);
    notifyChange();
  }
}

// ---------- meta ----------
export async function getMeta(key, fallback = null) {
  const db = await getDB();
  const row = await db.get('meta', key);
  return row ? row.value : fallback;
}

export async function setMeta(key, value) {
  const db = await getDB();
  await db.put('meta', { key, value });
}

// ---------- reset / bulk ----------
export async function clearAll() {
  const db = await getDB();
  const [oldB, oldP, tombs] = await Promise.all([db.getAll('bonds'), db.getAll('portfolios'), readTombs(db)]);
  const now = new Date().toISOString();
  for (const b of oldB) if (!b.isDemo) tombs.bonds[b.id] = now;
  for (const p of oldP) if (!p.isDemo) tombs.portfolios[p.id] = now;
  const tx = db.transaction(['bonds', 'portfolios', 'meta'], 'readwrite');
  await Promise.all([
    tx.objectStore('bonds').clear(),
    tx.objectStore('portfolios').clear(),
    tx.objectStore('meta').put({ key: TOMB_KEY, value: tombs }),
    tx.done,
  ]);
  notifyChange();
}

export async function isEmpty() {
  const db = await getDB();
  const count = await db.count('bonds');
  const pcount = await db.count('portfolios');
  return count === 0 && pcount === 0;
}

export async function replaceAllData({ bonds = [], portfolios = [] }) {
  const db = await getDB();
  const [oldB, oldP, tombs] = await Promise.all([db.getAll('bonds'), db.getAll('portfolios'), readTombs(db)]);
  const now = new Date().toISOString();
  const keepB = new Set(bonds.map((b) => b.id));
  const keepP = new Set(portfolios.map((p) => p.id));
  for (const b of oldB) if (!b.isDemo && !keepB.has(b.id)) tombs.bonds[b.id] = now;
  for (const p of oldP) if (!p.isDemo && !keepP.has(p.id)) tombs.portfolios[p.id] = now;
  for (const id of keepB) delete tombs.bonds[id];
  for (const id of keepP) delete tombs.portfolios[id];
  const tx = db.transaction(['bonds', 'portfolios', 'meta'], 'readwrite');
  await tx.objectStore('bonds').clear();
  await tx.objectStore('portfolios').clear();
  // L'import è una scelta esplicita: i record importati valgono "adesso" per la sincronizzazione.
  for (const b of bonds) await tx.objectStore('bonds').put({ ...b, updatedAt: now });
  for (const p of portfolios) await tx.objectStore('portfolios').put({ ...p, updatedAt: now });
  await tx.objectStore('meta').put({ key: TOMB_KEY, value: tombs });
  await tx.done;
  notifyChange();
}

/** Applica i record arrivati dalla sincronizzazione, senza creare lapidi né notificare cambi. */
export async function applyRemoteChanges({ putBonds = [], delBonds = {}, putPortfolios = [], delPortfolios = {} }) {
  const db = await getDB();
  const tombs = await readTombs(db);
  const tx = db.transaction(['bonds', 'portfolios', 'meta'], 'readwrite');
  for (const b of putBonds) {
    const old = await tx.objectStore('bonds').get(b.id);
    await tx.objectStore('bonds').put({ lastNotified: { scadenza: {}, prescrizione: {} }, ...b, ...(old?.lastNotified ? { lastNotified: old.lastNotified } : {}) });
    delete tombs.bonds[b.id];
  }
  for (const p of putPortfolios) {
    await tx.objectStore('portfolios').put(p);
    delete tombs.portfolios[p.id];
  }
  for (const [id, at] of Object.entries(delBonds)) {
    await tx.objectStore('bonds').delete(id);
    tombs.bonds[id] = at;
  }
  for (const [id, at] of Object.entries(delPortfolios)) {
    await tx.objectStore('portfolios').delete(id);
    tombs.portfolios[id] = at;
  }
  await tx.objectStore('meta').put({ key: TOMB_KEY, value: tombs });
  await tx.done;
}

/** Record grezzi (compresi demo) per la sincronizzazione. */
export async function readForSync() {
  const db = await getDB();
  const [bonds, portfolios, tombs] = await Promise.all([db.getAll('bonds'), db.getAll('portfolios'), readTombs(db)]);
  return { bonds, portfolios, tombs };
}

export async function deleteDemoData() {
  const db = await getDB();
  const bonds = await db.getAll('bonds');
  const portfolios = await db.getAll('portfolios');
  const tx = db.transaction(['bonds', 'portfolios'], 'readwrite');
  for (const b of bonds) if (b.isDemo) await tx.objectStore('bonds').delete(b.id);
  for (const p of portfolios) if (p.isDemo) await tx.objectStore('portfolios').delete(p.id);
  await tx.done;
  await setMeta('demoSeeded', false);
}

export { uid };

/** Esportazione d'emergenza: legge i dati grezzi senza passare dalla normalizzazione. */
export async function dumpRaw() {
  const db = await getDB();
  const [bonds, portfolios] = await Promise.all([db.getAll('bonds'), db.getAll('portfolios')]);
  return { bonds, portfolios };
}

/** Cancella l'intero database locale (usato solo dalla schermata di errore, con conferma). */
export async function deleteDatabase() {
  try {
    const db = await Promise.race([getDB(), new Promise((r) => setTimeout(() => r(null), 1500))]);
    db?.close?.();
  } catch {
    /* il db potrebbe non aprirsi: lo eliminiamo comunque */
  }
  dbPromise = null;
  await new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new DBOpenError('blocked', 'Chiudi le altre schede di Cassetto e riprova.'));
  });
}
