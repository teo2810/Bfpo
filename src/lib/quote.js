// quoteBond è una funzione pura: nessuna chiamata di rete, nessun accesso a IndexedDB.
// Produce sempre una STIMA, mai un valore ufficiale. Se manca il valore a scadenza
// ripiega sul nominale e segnala chiaramente che si tratta di una stima.

const DAY = 86400000;

function toDate(d) {
  return d instanceof Date ? d : new Date(d);
}

function isValidDate(d) {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

/**
 * Giorno di calendario (mezzanotte UTC) di una data salvata. Le date dei buoni sono salvate
 * come mezzanotte UTC ('YYYY-MM-DD' → ISO): leggiamo quindi i componenti UTC.
 */
export function dayOf(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    // Data di calendario stretta: niente overflow (2020-13-45 non diventa 14/02/2021).
    const [y, m, d] = value.slice(0, 10).split('-').map(Number);
    const ms = Date.UTC(y, m - 1, d);
    const chk = new Date(ms);
    if (chk.getUTCFullYear() !== y || chk.getUTCMonth() !== m - 1 || chk.getUTCDate() !== d) return null;
    if (value.length === 10) return ms;
  }
  const d = toDate(value);
  if (!isValidDate(d)) return null;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Giorno di calendario locale di "adesso" (o di una data runtime), come mezzanotte UTC. */
export function localDayOf(date = new Date()) {
  const d = toDate(date);
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
}

function toNumberOrNull(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Cambio fisso irrevocabile euro/lira (Reg. CE 2866/98): 1 € = 1936,27 lire. */
export const ITL_PER_EUR = 1936.27;
export const VALUTE = ['EUR', 'ITL'];
/** Importi massimi accettati (circa 10 milioni di euro). */
export const MAX_EUR = 10_000_000;
export const MAX_ITL = 20_000_000_000;

/** Valuta del buono: ITL (anche "LIT"/"lire") oppure EUR. I record senza valuta valgono EUR. */
export function normalizeValuta(v) {
  const s = String(v ?? '').trim().toUpperCase();
  return s === 'ITL' || s === 'LIT' || s === 'LIRE' ? 'ITL' : 'EUR';
}

/** True se il valore è una valuta riconosciuta oppure assente (vecchi record = EUR). */
export function isKnownValuta(v) {
  if (v == null || v === '') return true;
  return ['EUR', 'ITL', 'LIT', 'LIRE'].includes(String(v).trim().toUpperCase());
}

const round2 = (n) => Math.round(n * 100) / 100;

/** Lire → euro, arrotondato al centesimo. */
export function itlToEur(lire) {
  return round2((Number(lire) || 0) / ITL_PER_EUR);
}

/** Euro → lire, arrotondato alla lira intera. */
export function eurToItl(eur) {
  return Math.round((Number(eur) || 0) * ITL_PER_EUR);
}

/** Importo del buono (nella sua valuta) espresso in euro, senza arrotondare (per i calcoli). */
export function amountToEur(amount, valuta) {
  const n = toNumberOrNull(amount);
  if (n == null) return null;
  return normalizeValuta(valuta) === 'ITL' ? n / ITL_PER_EUR : n;
}

/** Valore nominale in euro (sempre EUR, anche per i buoni in lire). */
export function nominaleEUR(bond) {
  return amountToEur(bond?.nominale, bond?.valuta) ?? 0;
}

/** Valore a scadenza in euro, o null. */
export function valoreScadenzaEUR(bond) {
  return amountToEur(bond?.valoreScadenza, bond?.valuta);
}

/** "L. 1.000.000" (formato it-IT, lire intere). */
export function formatLire(value) {
  const n = Math.round(Number(value) || 0);
  // Separatore delle migliaia sempre presente (anche per 4 cifre: L. 5.000), come sui titoli.
  return `L. ${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

/** Importo nella valuta indicata: "L. 1.000.000" oppure "1.000,00 €". */
export function formatMoney(value, valuta) {
  return normalizeValuta(valuta) === 'ITL' ? formatLire(value) : formatEUR(value);
}

/**
 * @param {object} bond - record del buono (nominale, dataEmissione, dataScadenza, valoreScadenza)
 * @param {Date|string} date - data alla quale stimare il valore
 * @returns {{ valore: number, isStima: boolean, metodo: string }}
 */
export function quoteBond(bond, date) {
  const valuta = normalizeValuta(bond.valuta);
  const nativo = quoteNative(bond, date, valuta === 'ITL' ? 0 : 2);
  if (valuta !== 'ITL') return { ...nativo, valuta };
  // Buono in lire: la stima si calcola in lire (interi), poi si converte in euro al cambio fisso.
  return { ...nativo, valuta, valoreOriginale: nativo.valore, valore: itlToEur(nativo.valore) };
}

function quoteNative(bond, date, decimali) {
  const nominale = toNumberOrNull(bond.nominale) ?? 0;
  const asOf = date instanceof Date ? localDayOf(date) : dayOf(date);
  const emissione = dayOf(bond.dataEmissione);
  const scadenza = dayOf(bond.dataScadenza);
  const valoreScadenza = toNumberOrNull(bond.valoreScadenza);

  // Titolo già scaduto: dopo la scadenza i BFP non maturano altri interessi.
  if (scadenza != null && asOf != null && asOf >= scadenza) {
    return {
      valore: valoreScadenza ?? nominale,
      isStima: true,
      metodo: valoreScadenza != null ? 'valore-a-scadenza' : 'nominale',
    };
  }

  // Con nominale, valore a scadenza e date note interpoliamo a capitalizzazione composta
  // (tasso medio costante equivalente): V(t) = N · (VS/N)^(t/T).
  if (emissione != null && scadenza != null && valoreScadenza != null && asOf != null && scadenza > emissione) {
    if (asOf <= emissione) return { valore: nominale, isStima: true, metodo: 'nominale' };
    const frazione = Math.min(1, Math.max(0, (asOf - emissione) / (scadenza - emissione)));
    let valore;
    if (nominale > 0 && valoreScadenza > 0) {
      valore = nominale * Math.pow(valoreScadenza / nominale, frazione);
    } else {
      valore = nominale + (valoreScadenza - nominale) * frazione;
    }
    const f = 10 ** decimali;
    return { valore: Math.round(valore * f) / f, isStima: true, metodo: 'interpolazione-composta' };
  }

  // Nessuna informazione sul rendimento: mostriamo il nominale, etichettato come stima.
  return { valore: nominale, isStima: true, metodo: 'nominale' };
}

/**
 * Quota di maturazione (0–1): interessi maturati oggi / interessi a scadenza.
 * Dopo la scadenza è 1. Senza valore a scadenza ripiega sul tempo trascorso tra emissione
 * e scadenza; se mancano anche le date restituisce null (non stimabile).
 */
export function maturazione(bond, date = new Date()) {
  const asOf = date instanceof Date ? localDayOf(date) : dayOf(date);
  const e = dayOf(bond.dataEmissione);
  const s = dayOf(bond.dataScadenza);
  const n = nominaleEUR(bond);
  const vs = valoreScadenzaEUR(bond);
  if (s != null && asOf != null && asOf >= s) return 1;
  if (vs != null && vs > n) {
    const v = quoteBond(bond, date).valore;
    return Math.min(1, Math.max(0, (v - n) / (vs - n)));
  }
  if (e != null && s != null && s > e && asOf != null) return Math.min(1, Math.max(0, (asOf - e) / (s - e)));
  return null;
}

/** Tasso annuo composto implicito (es. 0.0244 = 2,44%/anno), o null se non calcolabile. */
export function impliedAnnualRate(bond) {
  const n = toNumberOrNull(bond.nominale);
  const vs = toNumberOrNull(bond.valoreScadenza);
  const e = dayOf(bond.dataEmissione);
  const s = dayOf(bond.dataScadenza);
  if (!n || !vs || n <= 0 || vs <= 0 || e == null || s == null || s <= e) return null;
  const anni = (s - e) / (365.25 * DAY);
  return Math.pow(vs / n, 1 / anni) - 1;
}

export function formatEUR(value) {
  const n = Number(value) || 0;
  return n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatPct(rate) {
  if (rate == null || !Number.isFinite(rate)) return '—';
  return `${(rate * 100).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

/**
 * Aggiunge anni (anche frazionari, arrotondati al mese) a una data, lavorando sul giorno UTC.
 * Se il giorno non esiste nel mese di arrivo (31 → febbraio, 29/02 → anno non bisestile)
 * usa l'ultimo giorno del mese. Restituisce una Date a mezzanotte UTC.
 */
export function addYears(date, years) {
  const base = dayOf(date instanceof Date ? date.toISOString() : date);
  if (base == null) return new Date(NaN);
  const d = new Date(base);
  const months = Math.round(Number(years) * 12);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + months;
  const day = d.getUTCDate();
  const targetY = y + Math.floor(m / 12);
  const targetM = ((m % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetY, targetM + 1, 0)).getUTCDate();
  return new Date(Date.UTC(targetY, targetM, Math.min(day, lastDay)));
}

/** Giorni di calendario da oggi (locale) alla data indicata: 0 = oggi, negativo = passata. */
export function daysUntil(dateStr, from = new Date()) {
  const target = dayOf(dateStr);
  if (target == null) return null;
  return Math.round((target - localDayOf(from)) / DAY);
}

/** 'YYYY-MM-DD' per gli <input type="date">, '' se la data manca o non è valida. */
export function toInputDate(value) {
  const d = dayOf(value);
  return d == null ? '' : new Date(d).toISOString().slice(0, 10);
}

/** Da 'YYYY-MM-DD' a ISO a mezzanotte UTC (formato di salvataggio), null se vuota. */
export function fromInputDate(value) {
  const d = dayOf(value);
  return d == null ? null : new Date(d).toISOString();
}

export function formatDate(value) {
  const d = dayOf(value);
  if (d == null) return '—';
  return new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
