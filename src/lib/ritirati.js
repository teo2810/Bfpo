import { nominaleEUR, dayOf } from './quote.js';

const DAY = 86400000;
const YEAR = 365.25;

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

/** Anni effettivi tra emissione e rimborso: giorni di calendario / 365,25. */
export function durataEffettivaAnni(bond) {
  const e = dayOf(bond?.dataEmissione);
  const r = dayOf(bond?.dataRimborso);
  if (e == null || r == null) return null;
  return (r - e) / (DAY * YEAR);
}

/**
 * Tasso medio annuo netto effettivo di un buono ritirato:
 * (importoIncassato / nominaleEUR)^(1 / anni) − 1, con anni = giorni(emissione, dataRimborso) / 365,25.
 * Null (in UI «—») se manca l'incasso, il nominale è 0 o gli anni sono ≤ 0.
 */
export function tassoEffettivoRitiro(bond) {
  if (!isRitirato(bond) || bond?.importoIncassato == null) return null;
  const n = nominaleEUR(bond);
  const inc = Number(bond.importoIncassato);
  if (!Number.isFinite(inc) || n <= 0) return null;
  const anni = durataEffettivaAnni(bond);
  if (anni == null || anni <= 0) return null;
  return Math.pow(inc / n, 1 / anni) - 1;
}

/** Interessi netti realizzati: incassato − nominale in euro. */
export function interessiRitiro(bond) {
  if (!isRitirato(bond) || bond?.importoIncassato == null) return null;
  const inc = Number(bond.importoIncassato);
  if (!Number.isFinite(inc)) return null;
  return inc - nominaleEUR(bond);
}

export function formatAnni(anni) {
  if (anni == null || !Number.isFinite(anni)) return '—';
  const t = anni.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return `${t} ${Math.abs(anni - 1) < 1e-9 ? 'anno' : 'anni'}`;
}

/**
 * Totale nominale (EUR) e incassato dei buoni ritirati, con differenza, rendimento
 * semplice (incassato/nominale − 1) e tasso medio complessivo.
 *
 * Tasso medio complessivo = CAGR ponderato:
 *   (Σ incassato / Σ nominale) ^ (1 / T) − 1
 * dove T è la durata media ponderata per il nominale in euro,
 *   T = Σ (nominale_i × anni_i) / Σ nominale_i
 * e anni_i = giorni(emissione, dataRimborso) / 365,25.
 * Entra nel CAGR solo chi ha nominale > 0, incasso numerico e durata > 0;
 * i totali di incassato/nominale restano calcolati su tutti i ritirati.
 */
export function riepilogoRitirati(bonds) {
  let incassato = 0;
  let nominale = 0;
  let pesoAnni = 0;
  let pesoNom = 0;
  let incCagr = 0;
  let nomCagr = 0;
  for (const b of buoniRitirati(bonds)) {
    const inc = Number(b.importoIncassato);
    if (Number.isFinite(inc)) incassato += inc;
    const n = nominaleEUR(b);
    nominale += n;
    const anni = durataEffettivaAnni(b);
    if (n > 0 && anni != null && anni > 0 && Number.isFinite(inc)) {
      pesoAnni += n * anni;
      pesoNom += n;
      incCagr += inc;
      nomCagr += n;
    }
  }
  const differenza = incassato - nominale;
  const rendimento = nominale > 0 ? differenza / nominale : null;
  const durataMedia = pesoNom > 0 ? pesoAnni / pesoNom : null;
  const tassoMedio = (durataMedia && durataMedia > 0 && nomCagr > 0)
    ? Math.pow(incCagr / nomCagr, 1 / durataMedia) - 1
    : null;
  return { incassato, nominale, differenza, rendimento, tassoMedio, durataMedia };
}
