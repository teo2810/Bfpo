/**
 * Stima dei BFP ordinari cartacei dalle tabelle in series.json (unico punto di verità).
 * Documentazione e fonti: src/data/TASSI.md.
 *
 * Convenzione (Poste Italiane, «Storico dei tassi applicati sui BFP ORDINARI», ed. 2017):
 * dal 1° al 20° anno gli interessi sono calcolati su base bimestrale in regime di
 * capitalizzazione semplice (1/6 del tasso annuo lordo per ogni bimestre compiuto
 * dalla data di emissione) e capitalizzati annualmente in regime composto.
 * Nessun interesse prima del compimento del primo anno.
 * Dal 21° al 30° anno: interesse semplice bimestrale sul montante del 20° anno
 * (Q/R al tasso massimo dello scaglione fino all'anniversario del 30°;
 * S–Z al 0,50% fino al 31/12 dell'anno di emissione + 30).
 *
 * Capitalizzazione annuale al netto della ritenuta per Q e R (e S emessa fino al
 * 31/12/1996); al lordo dalla serie T e per S dal 1/1/1997.
 * Fonte: D.M. 23/06/1997, G.U. 24/06/1997 n. 145, art. 7 (097A5032).
 *
 * Ritenuta / imposta sostitutiva: 12,5% sugli interessi.
 */
import seriesCatalog from '../data/series.json' with { type: 'json' };

// Helper di data locali (non importare quote.js: eviterebbe un ciclo con quoteScaglioni).
function dayOf(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const [y, m, d] = value.slice(0, 10).split('-').map(Number);
    const ms = Date.UTC(y, m - 1, d);
    const chk = new Date(ms);
    if (chk.getUTCFullYear() !== y || chk.getUTCMonth() !== m - 1 || chk.getUTCDate() !== d) return null;
    return ms;
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function localDayOf(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
}

function formatPct(rate) {
  if (rate == null || !Number.isFinite(rate)) return '—';
  return `${(rate * 100).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

export const RITENUTA = 0.125;
export const TABELLE_TASSI = seriesCatalog.ordinario?.tabelleTassi || {};
export const TABELLE_IDS = Object.keys(TABELLE_TASSI);

export function normalizeTabellaTassi(v) {
  const s = String(v ?? '').trim().toUpperCase();
  return TABELLE_IDS.includes(s) ? s : '';
}

function addUtcMonths(ms, months) {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + months;
  const day = d.getUTCDate();
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return Date.UTC(y, m, Math.min(day, last));
}

/** Bimestri compiuti tra due giorni di calendario (mezzanotte UTC). */
export function completedBimesters(from, to) {
  const a = dayOf(from);
  const b = typeof to === 'number' && Number.isFinite(to) ? to : dayOf(to);
  if (a == null || b == null || b <= a) return 0;
  let n = 0;
  let cur = a;
  while (true) {
    const next = addUtcMonths(cur, 2);
    if (next > b) break;
    n += 1;
    cur = next;
  }
  return n;
}

export function getTabella(id) {
  const key = normalizeTabellaTassi(id);
  return key ? TABELLE_TASSI[key] : null;
}

function inPeriodo(tab, emissione) {
  const e = dayOf(emissione);
  if (e == null) return false;
  const dal = dayOf(tab.emissioneDal);
  const al = dayOf(tab.emissioneAl);
  if (dal != null && e < dal) return false;
  if (al != null && e > al) return false;
  return true;
}

/** Inferisce la lettera dalla data di emissione, o null. */
export function inferTabellaDaData(emissione) {
  for (const id of TABELLE_IDS) {
    if (inPeriodo(TABELLE_TASSI[id], emissione)) return id;
  }
  return '';
}

/**
 * Risolve la tabella da usare per un buono.
 * Priorità: campo tabellaTassi (sovratimbrato) → inferenza da data se la serie è ordinaria.
 * I buoni dedicati ai minori non usano mai queste tabelle.
 */
export function resolveTabellaId(bond) {
  if (!bond || bond.serieKey === 'minori') return '';
  const explicit = normalizeTabellaTassi(bond.tabellaTassi);
  if (explicit) return explicit;
  const ordinario = bond.serieKey === 'ordinario' || /ordinario/i.test(String(bond.serie || ''));
  if (!ordinario) return '';
  return inferTabellaDaData(bond.dataEmissione) || '';
}

export function resolveTabella(bond) {
  const id = resolveTabellaId(bond);
  return id ? { id, ...TABELLE_TASSI[id] } : null;
}

function scaglionePerAnno(tab, year) {
  if (year < 1) year = 1;
  const list = tab.scaglioni || [];
  for (const s of list) {
    if (year >= s.da && year <= s.a) return s;
  }
  return list[list.length - 1] || null;
}

function isNetCap(tab, emissione) {
  if (tab.capitalizzazione === 'annuale-netta') return true;
  // Serie S emessa fino al 31/12/1996: capitalizzazione al netto (art. 7 D.M. 23/06/1997).
  if (tab.id === 'S' || tab.label === 'Serie S') {
    const e = dayOf(emissione);
    const cut = dayOf('1996-12-31');
    if (e != null && cut != null && e <= cut) return true;
  }
  return false;
}

function fineInteressi(tab, emissione) {
  const e = dayOf(emissione);
  if (e == null) return null;
  if (tab.fineInteressi === '31-12-anno-30') {
    return Date.UTC(new Date(e).getUTCFullYear() + 30, 11, 31);
  }
  return addUtcMonths(e, 30 * 12);
}

function roundTo(n, decimali) {
  const f = 10 ** decimali;
  return Math.round(n * f) / f;
}

/**
 * Scaglione corrente alla data indicata, con etichetta per l'UI.
 * @returns {{ tasso: number, da: number, a: number, daVerificare: boolean, label: string, tabellaId: string } | null}
 */
export function tassoCorrente(bond, date = new Date()) {
  const tab = resolveTabella(bond);
  if (!tab) return null;
  const emissione = dayOf(bond.dataEmissione);
  if (emissione == null) return null;
  const asOf = date instanceof Date ? localDayOf(date) : dayOf(date);
  if (asOf == null) return null;
  const bim = completedBimesters(emissione, asOf);
  // Anno di detenzione in corso (1-based); prima del 1° bimestre resta lo scaglione 1–5.
  const year = Math.min(30, Math.max(1, Math.floor(bim / 6) + (bim % 6 === 0 && bim > 0 ? 0 : 1)));
  const s = scaglionePerAnno(tab, year);
  if (!s) return null;
  const daVerificare = !!s.daVerificare;
  const label = `Tasso attuale ${formatPct(s.tasso)} · anni ${s.da}-${s.a}${daVerificare ? ' (da verificare)' : ''}`;
  return { tasso: s.tasso, da: s.da, a: s.a, daVerificare, label, tabellaId: tab.id };
}

/**
 * Stima da nominale + scaglioni. Restituisce null se non c'è una tabella applicabile.
 * `decimali`: 2 per euro, 0 per lire (valori nella valuta nativa del buono).
 */
export function quoteScaglioni(bond, date, decimali = 2) {
  const tab = resolveTabella(bond);
  if (!tab) return null;
  const nominale = Number(bond.nominale);
  if (!Number.isFinite(nominale) || nominale < 0) return null;
  const emissione = dayOf(bond.dataEmissione);
  if (emissione == null) return null;
  const rawAsOf = date instanceof Date ? localDayOf(date) : dayOf(date);
  if (rawAsOf == null) return null;

  const cap = fineInteressi(tab, emissione);
  const asOf = cap != null && rawAsOf > cap ? cap : rawAsOf;

  const empty = (extra = {}) => ({
    valore: roundTo(nominale, decimali),
    isStima: true,
    metodo: 'scaglioni',
    valoreLordo: roundTo(nominale, decimali),
    interessi: 0,
    ritenuta: 0,
    valoreNetto: roundTo(nominale, decimali),
    tabellaTassi: tab.id,
    ...extra,
  });

  if (asOf <= emissione) return empty();

  const bim = completedBimesters(emissione, asOf);
  const tc = tassoCorrente(bond, date);
  const corrente = tc
    ? { tassoAttuale: tc.tasso, scaglione: `${tc.da}-${tc.a}`, tassoLabel: tc.label, daVerificare: tc.daVerificare }
    : {};

  // Prima del primo anno: nessun interesse.
  if (bim < 6) return empty(corrente);

  const net = isNetCap(tab, bond.dataEmissione);
  const yearsDone = Math.min(20, Math.floor(bim / 6));
  let montante = nominale;
  let interessiLordo = 0;

  for (let y = 1; y <= yearsDone; y++) {
    const s = scaglionePerAnno(tab, y);
    const r = s?.tasso ?? 0;
    const g = montante * r;
    interessiLordo += g;
    montante += net ? g * (1 - RITENUTA) : g;
  }

  if (bim <= 120) {
    const rem = bim - yearsDone * 6;
    if (rem > 0) {
      const s = scaglionePerAnno(tab, yearsDone + 1);
      const g = montante * (s?.tasso ?? 0) * (rem / 6);
      interessiLordo += g;
    }
  } else {
    const end = cap != null ? Math.min(asOf, cap) : asOf;
    const start21 = addUtcMonths(emissione, 20 * 12);
    const bimSimple = completedBimesters(start21, end);
    const s = scaglionePerAnno(tab, 21);
    const g = montante * (s?.tasso ?? 0) * (bimSimple / 6);
    interessiLordo += g;
  }

  const ritenuta = interessiLordo * RITENUTA;
  const lordo = nominale + interessiLordo;
  const netto = lordo - ritenuta;
  return {
    valore: roundTo(netto, decimali),
    isStima: true,
    metodo: 'scaglioni',
    valoreLordo: roundTo(lordo, decimali),
    interessi: roundTo(interessiLordo, decimali),
    ritenuta: roundTo(ritenuta, decimali),
    valoreNetto: roundTo(netto, decimali),
    tabellaTassi: tab.id,
    ...corrente,
  };
}

export function opzioniTabelle() {
  return TABELLE_IDS.map((id) => ({ id, label: TABELLE_TASSI[id].label || `Serie ${id}` }));
}
