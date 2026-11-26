import { uid } from './db.js';
import { normalizeBond } from './normalize.js';
import { isKnownValuta, normalizeValuta, MAX_EUR, MAX_ITL } from './quote.js';

const MAGIC = 'CASSETTO-ENC-V1';

const DATE_FIELDS = ['dataEmissione', 'dataScadenza', 'dataPrescrizione'];

/**
 * Accetta solo date di calendario reali. '2020-13-45' (e ogni overflow tipo 30 febbraio)
 * viene rifiutata: il confronto è un andata e ritorno anno/mese/giorno, senza normalizzazione.
 * Vuoto/null è consentito.
 */
export function isStrictCalendarDate(value) {
  if (value == null || value === '') return true;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return false;
    value = value.toISOString();
  }
  const m = String(value).trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() + 1 === mo && dt.getUTCDate() === d;
}

function assertBondDates(bond) {
  for (const field of DATE_FIELDS) {
    const raw = bond[field];
    if (isStrictCalendarDate(raw)) continue;
    const chi = bond.numero ? `n. ${bond.numero}` : 'senza numero';
    throw new Error(`Il backup contiene una data non valida (${raw}) nel buono ${chi}.`);
  }
}

/** Valuta riconosciuta (assente = EUR) e importi sensati: ITL interi ≥ 1 lira, entro i massimi. */
function assertBondAmounts(bond) {
  const chi = bond.numero ? `n. ${bond.numero}` : 'senza numero';
  if (!isKnownValuta(bond.valuta)) {
    throw new Error(`Il backup contiene una valuta non riconosciuta (${bond.valuta}) nel buono ${chi}: sono ammessi EUR e ITL.`);
  }
  const itl = normalizeValuta(bond.valuta) === 'ITL';
  const max = itl ? MAX_ITL : MAX_EUR;
  for (const field of ['nominale', 'valoreScadenza']) {
    const raw = bond[field];
    if (raw == null || raw === '') continue;
    const n = Number(typeof raw === 'string' ? raw.replace(',', '.') : raw);
    if (!Number.isFinite(n) || n < 0 || n > max) {
      throw new Error(`Il backup contiene un importo non valido (${raw}) nel buono ${chi}.`);
    }
  }
}

/** Un backup valido ma senza buoni non deve cancellare i dati già presenti, salvo conferma esplicita. */
export function emptyImportWouldWipe(backup, { bonds = [], portfolios = [] } = {}) {
  return !backup?.bonds?.length && (bonds.length > 0 || portfolios.length > 0);
}

/** Rende sicuro un backup importato: id presenti, numeri validi, date strette, niente record di demo. */
export function normalizeBackup(obj) {
  const portfolios = (Array.isArray(obj.portfolios) ? obj.portfolios : [])
    .filter((p) => p && typeof p === 'object' && !p.isDemo)
    .map((p) => ({ id: String(p.id || uid()), nome: String(p.nome || 'Portafoglio'), colore: p.colore || 'cyan', isDemo: false }));
  const pIds = new Set(portfolios.map((p) => p.id));
  const bonds = obj.bonds
    .filter((b) => b && typeof b === 'object' && !b.isDemo)
    .map((b) => {
      assertBondDates(b);
      assertBondAmounts(b);
      return {
      ...b,
      id: String(b.id || uid()),
      numero: String(b.numero ?? ''),
      valuta: normalizeValuta(b.valuta),
      nominale: Number(b.nominale) || 0,
      valoreScadenza: b.valoreScadenza == null || b.valoreScadenza === '' ? null : Number(b.valoreScadenza) || null,
      intestatari: Array.isArray(b.intestatari) ? b.intestatari.map(String) : [],
      portafoglioId: b.portafoglioId && pIds.has(b.portafoglioId) ? b.portafoglioId : null,
      lastNotified: b.lastNotified || { scadenza: {}, prescrizione: {} },
      isDemo: false,
      };
    })
    .map(normalizeBond);
  return { ...obj, bonds, portfolios };
}

async function deriveKey(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

function toB64(buf) {
  const bytes = new Uint8Array(buf);
  let s = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}
function fromB64(str) {
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
}

export async function buildBackupPayload({ bonds, portfolios, meta }) {
  return {
    app: 'cassetto',
    version: 1,
    exportedAt: new Date().toISOString(),
    bonds: bonds.filter((b) => !b.isDemo),
    portfolios: portfolios.filter((p) => !p.isDemo),
    meta: { theme: meta?.theme },
  };
}

export async function exportBackup(payload, password) {
  const json = JSON.stringify(payload, null, 2);
  if (!password) {
    return new Blob([json], { type: 'application/json' });
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const enc = new TextEncoder();
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(json));
  const wrapper = {
    magic: MAGIC,
    salt: toB64(salt),
    iv: toB64(iv),
    data: toB64(cipher),
  };
  return new Blob([JSON.stringify(wrapper)], { type: 'application/json' });
}

export { downloadFile as downloadBlob } from './ics.js';

export async function parseBackupFile(text, password) {
  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    throw new Error('File non valido: non è JSON leggibile.');
  }
  if (obj.magic === MAGIC) {
    if (!password) throw new Error('Questo backup è cifrato: inserisci la password.');
    try {
      const salt = fromB64(obj.salt);
      const iv = fromB64(obj.iv);
      const key = await deriveKey(password, salt);
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, fromB64(obj.data));
      const json = new TextDecoder().decode(plain);
      obj = JSON.parse(json);
    } catch {
      throw new Error('Password errata o file corrotto.');
    }
  }
  if (obj.app !== 'cassetto' || !Array.isArray(obj.bonds)) {
    throw new Error('Il file non è un backup di Cassetto riconoscibile.');
  }
  return normalizeBackup(obj);
}
