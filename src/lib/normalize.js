// Normalizzazione difensiva dei record letti da IndexedDB: dati scritti da versioni vecchie
// (o modificati a mano) non devono mai far crashare il render.
import { dayOf, normalizeValuta } from './quote.js';

const DATE_FIELDS = ['dataEmissione', 'dataScadenza', 'dataPrescrizione', 'dataRimborso'];
const COLORS = new Set(['cyan', 'mint', 'amber', 'coral', 'violet']);

function num(v, fallback) {
  if (v == null || v === '') return fallback;
  const n = Number(typeof v === 'string' ? v.replace(',', '.') : v);
  return Number.isFinite(n) ? n : fallback;
}

function str(v) {
  if (v == null) return '';
  return typeof v === 'string' ? v : String(v);
}

function dateOrNull(v) {
  const d = dayOf(v);
  return d == null ? null : new Date(d).toISOString();
}

function plainObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
}

export function normalizePortfolio(p) {
  if (!p || typeof p !== 'object' || p.id == null) return null;
  return {
    ...p,
    id: String(p.id),
    nome: str(p.nome).trim() || 'Portafoglio',
    colore: COLORS.has(p.colore) ? p.colore : 'cyan',
    isDemo: !!p.isDemo,
  };
}

export function normalizeBond(b) {
  if (!b || typeof b !== 'object' || b.id == null) return null;
  const valuta = normalizeValuta(b.valuta);
  const out = {
    ...b,
    id: String(b.id),
    tipo: b.tipo === 'altro' ? 'altro' : 'bfp',
    serie: str(b.serie),
    serieKey: str(b.serieKey),
    numero: str(b.numero),
    valuta,
    nominale: (() => {
      const n = Math.max(0, num(b.nominale, 0));
      return valuta === 'ITL' ? Math.round(n) : n;
    })(),
    valoreScadenza: (() => {
      const v = num(b.valoreScadenza, null);
      if (v == null || v <= 0) return null;
      return valuta === 'ITL' ? Math.max(1, Math.round(v)) : v;
    })(),
    intestatari: Array.isArray(b.intestatari)
      ? b.intestatari.map(str).filter(Boolean)
      : typeof b.intestatari === 'string'
        ? b.intestatari.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
    portafoglioId: b.portafoglioId == null || b.portafoglioId === '' ? null : String(b.portafoglioId),
    note: str(b.note),
    lastNotified: {
      scadenza: plainObject(b.lastNotified?.scadenza),
      prescrizione: plainObject(b.lastNotified?.prescrizione),
    },
    isDemo: !!b.isDemo,
    rimborsato: !!b.rimborsato,
  };
  for (const f of DATE_FIELDS) out[f] = dateOrNull(b[f]);
  if (!out.rimborsato) {
    out.dataRimborso = null;
    out.importoIncassato = null;
  } else {
    const inc = num(b.importoIncassato, null);
    out.importoIncassato = inc == null || inc < 0 ? null : inc;
  }
  delete out.checklist; // i backup/record vecchi la portano ancora: si scarta in silenzio
  return out;
}

export function normalizeBonds(list) {
  return (Array.isArray(list) ? list : []).map(normalizeBond).filter(Boolean);
}

export function normalizePortfolios(list) {
  return (Array.isArray(list) ? list : []).map(normalizePortfolio).filter(Boolean);
}
