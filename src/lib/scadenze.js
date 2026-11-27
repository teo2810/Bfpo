import { daysUntil, dayOf, maturazione, quoteBond } from './quote.js';
import { isRitirato } from './ritirati.js';

/** Tutte le date rilevanti (scadenza e prescrizione) dei buoni, in ordine cronologico. */
export function buildEvents(bonds, now = new Date()) {
  const out = [];
  for (const b of bonds) {
    if (isRitirato(b)) continue;
    for (const [field, kind] of [['dataScadenza', 'scadenza'], ['dataPrescrizione', 'prescrizione']]) {
      const day = dayOf(b[field]);
      if (day == null) continue;
      out.push({ bond: b, kind, day, days: daysUntil(b[field], now), mat: maturazione(b, now) });
    }
  }
  return out.sort((a, b) => a.day - b.day || String(a.bond.numero).localeCompare(String(b.bond.numero)));
}

/** Raggruppa gli eventi per giorno, conservando tutti i buoni di quella data. */
export function groupEventsByDay(events) {
  const map = new Map();
  for (const e of events) {
    if (!map.has(e.day)) map.set(e.day, []);
    map.get(e.day).push(e);
  }
  return [...map.entries()].map(([day, items]) => ({
    day,
    days: items[0].days,
    items,
  }));
}

/** Raggruppa i giorni per mese solare (UTC), per intestazioni in elenco. */
export function groupDaysByMonth(dayGroups) {
  const months = [];
  for (const g of dayGroups) {
    const d = new Date(g.day);
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
    const last = months[months.length - 1];
    if (!last || last.key !== key) {
      months.push({
        key,
        label: d.toLocaleDateString('it-IT', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
        days: [g],
      });
    } else {
      last.days.push(g);
    }
  }
  return months;
}

/** Buoni distinti di un giorno, con conteggio e totale stimato (per la hero e il gruppo). */
export function riepilogoGiorno(items, date = new Date()) {
  const map = new Map();
  for (const e of items || []) {
    const b = e?.bond;
    if (b?.id != null && !map.has(b.id)) map.set(b.id, { bond: b, kinds: [] });
    if (b?.id != null) map.get(b.id).kinds.push(e.kind);
  }
  const bonds = [...map.values()].map((x) => {
    const valore = quoteBond(x.bond, date).valore;
    return { ...x, valore };
  });
  const totale = bonds.reduce((s, x) => s + x.valore, 0);
  return { count: bonds.length, totale, bonds: bonds.map((x) => x.bond), entries: bonds };
}
