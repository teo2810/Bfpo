// quoteBond è una funzione pura: nessuna chiamata di rete, nessun accesso a IndexedDB.
// Produce sempre una STIMA, mai un valore ufficiale. Se manca una curva di rendimento
// per la serie, ripiega sul nominale e segnala chiaramente che si tratta di una stima.

function daysBetween(a, b) {
  return (b.getTime() - a.getTime()) / 86400000;
}

function toDate(d) {
  return d instanceof Date ? d : new Date(d);
}

/**
 * @param {object} bond - record del buono (nominale, dataEmissione, dataScadenza, valoreScadenza)
 * @param {Date|string} date - data alla quale stimare il valore
 * @param {object} [catalog] - catalogo serie (non usato per inventare tassi, solo per metadati)
 * @returns {{ valore: number, isStima: boolean, metodo: string }}
 */
export function quoteBond(bond, date, catalog) {
  const nominale = Number(bond.nominale) || 0;
  const asOf = toDate(date);
  const emissione = bond.dataEmissione ? toDate(bond.dataEmissione) : null;
  const scadenza = bond.dataScadenza ? toDate(bond.dataScadenza) : null;
  const valoreScadenza = bond.valoreScadenza != null ? Number(bond.valoreScadenza) : null;

  // Titolo già scaduto: alla scadenza il valore noto è quello dichiarato (o il nominale).
  if (scadenza && asOf >= scadenza) {
    return {
      valore: valoreScadenza != null ? valoreScadenza : nominale,
      isStima: true,
      metodo: 'valore-a-scadenza',
    };
  }

  // Se conosciamo sia il nominale sia il valore a scadenza dichiarato dall'utente,
  // interpoliamo linearmente nel tempo come approssimazione grezza (non un rendimento reale).
  if (emissione && scadenza && valoreScadenza != null && asOf >= emissione) {
    const totale = daysBetween(emissione, scadenza);
    const trascorsi = daysBetween(emissione, asOf);
    const frazione = totale > 0 ? Math.min(1, Math.max(0, trascorsi / totale)) : 0;
    const valore = nominale + (valoreScadenza - nominale) * frazione;
    return { valore, isStima: true, metodo: 'interpolazione-lineare' };
  }

  // Nessuna curva disponibile: mostriamo il nominale, chiaramente etichettato come stima.
  return { valore: nominale, isStima: true, metodo: 'nominale' };
}

export function formatEUR(value) {
  const n = Number(value) || 0;
  return n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });
}

export function addYears(date, years) {
  const d = toDate(date);
  const copy = new Date(d.getTime());
  copy.setFullYear(copy.getFullYear() + Math.floor(years));
  const fracMonths = Math.round((years % 1) * 12);
  if (fracMonths) copy.setMonth(copy.getMonth() + fracMonths);
  return copy;
}

export function daysUntil(dateStr, from = new Date()) {
  if (!dateStr) return null;
  return Math.ceil(daysBetween(from, toDate(dateStr)));
}
