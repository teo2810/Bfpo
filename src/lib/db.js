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
  const toSave = {
    lastNotified: { scadenza: {}, prescrizione: {} },
    ...bond,
    id: bond.id || uid(),
    createdAt: bond.createdAt || now,
    updatedAt: now,
  };
  await db.put('bonds', toSave);
  return toSave;
}

export async function deleteBond(id) {
  const db = await getDB();
  return db.delete('bonds', id);
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
  const toSave = { id: p.id || uid(), nome: p.nome, colore: p.colore || 'cyan', isDemo: !!p.isDemo };
  await db.put('portfolios', toSave);
  return toSave;
}

export async function deletePortfolio(id) {
  const db = await getDB();
  return db.delete('portfolios', id);
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
  const tx = db.transaction(['bonds', 'portfolios'], 'readwrite');
  await Promise.all([
    tx.objectStore('bonds').clear(),
    tx.objectStore('portfolios').clear(),
    tx.done,
  ]);
}

export async function isEmpty() {
  const db = await getDB();
  const count = await db.count('bonds');
  const pcount = await db.count('portfolios');
  return count === 0 && pcount === 0;
}

export async function replaceAllData({ bonds = [], portfolios = [] }) {
  const db = await getDB();
  const tx = db.transaction(['bonds', 'portfolios'], 'readwrite');
  await tx.objectStore('bonds').clear();
  await tx.objectStore('portfolios').clear();
  for (const b of bonds) await tx.objectStore('bonds').put(b);
  for (const p of portfolios) await tx.objectStore('portfolios').put(p);
  await tx.done;
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
