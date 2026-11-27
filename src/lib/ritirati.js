import { nominaleEUR } from './quote.js';

/** Un buono è ritirato solo se il flag è esplicitamente vero. */
export function isRitirato(bond) {
  return !!bond?.rimborsato;
}

export function buoniAttivi(bonds) {
  return (bonds || []).filter((b) => !isRitirato(b));
}

export function buoniRitirati(bonds) {
  return (bonds || []).filter(isRitirato);
}

/** Totale nominale (EUR) e incassato dei buoni ritirati, con differenza e rendimento. */
export function riepilogoRitirati(bonds) {
  let incassato = 0;
  let nominale = 0;
  for (const b of buoniRitirati(bonds)) {
    const inc = Number(b.importoIncassato);
    if (Number.isFinite(inc)) incassato += inc;
    nominale += nominaleEUR(b);
  }
  const differenza = incassato - nominale;
  const rendimento = nominale > 0 ? differenza / nominale : null;
  return { incassato, nominale, differenza, rendimento };
}
