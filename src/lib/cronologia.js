import { dayOf, localDayOf } from './quote.js';

/** Stati e riempimento della cronologia di un buono (emissione, scadenza, prescrizione). */
export function cronologiaStati(steps, now = new Date()) {
  const t = localDayOf(now);
  const list = (steps || []).filter((s) => s && dayOf(s.date) != null);
  const days = list.map((s) => dayOf(s.date));
  const nextIdx = days.findIndex((d) => t <= d);
  const items = list.map((s, i) => {
    let state;
    let stato;
    if (nextIdx === -1 || t > days[i]) {
      state = 'passata';
      stato = 'Passata';
    } else if (i === nextIdx) {
      state = 'prossima';
      stato = t === days[i] ? 'Oggi' : 'Prossima';
    } else {
      state = 'futura';
      stato = 'Futura';
    }
    return { ...s, state, stato };
  });
  const segments = [];
  for (let i = 0; i < days.length - 1; i++) {
    const a = days[i];
    const b = days[i + 1];
    let fill = 0;
    if (t >= b) fill = 1;
    else if (t <= a || b <= a) fill = 0;
    else fill = (t - a) / (b - a);
    segments.push(fill);
  }
  return { items, segments };
}
