import { openDB } from 'idb';

const DB_NAME = 'cassetto-db';
const DB_VERSION = 1;

let dbPromise = null;

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('bonds')) {
          const bonds = db.createObjectStore('bonds', { keyPath: 'id' });
          bonds.createIndex('portfolioId', 'portfolioId');
          bonds.createIndex('dataScadenza', 'dataScadenza');
          bonds.createIndex('dataPrescrizione', 'dataPrescrizione');
        }
        if (!db.objectStoreNames.contains('portfolios')) {
          db.createObjectStore('portfolios', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

// ---------- bonds ----------
export async function listBonds() {
  const db = await getDB();
  return db.getAll('bonds');
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
  return db.getAll('portfolios');
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
  const tx = db.transaction(['bonds', 'portfolios', 'meta'], 'readwrite');
  await Promise.all([
    tx.objectStore('bonds').clear(),
    tx.objectStore('portfolios').clear(),
    tx.objectStore('meta').clear(),
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
