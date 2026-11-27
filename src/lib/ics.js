import { dayOf, formatMoney, formatEUR, nominaleEUR, normalizeValuta } from './quote.js';
import { isRitirato } from './ritirati.js';

const ALARM_DAYS = [90, 60, 30, 7];

function pad(n) { return String(n).padStart(2, '0'); }

function icsDay(ms) {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}

export function escapeText(s = '') {
  return String(s).replace(/\\/g, '\\\\').replace(/([,;])/g, '\\$1').replace(/\r?\n/g, '\\n');
}

/** RFC 5545 §3.1: righe al massimo di 75 ottetti, continuazione con CRLF + spazio. */
export function foldLine(line) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const parts = [];
  let cur = '';
  let curLen = 0;
  for (const ch of line) {
    const len = enc.encode(ch).length;
    const limit = parts.length === 0 ? 75 : 74;
    if (curLen + len > limit) {
      parts.push(cur);
      cur = '';
      curLen = 0;
    }
    cur += ch;
    curLen += len;
  }
  parts.push(cur);
  return parts.join('\r\n ');
}

function stamp() {
  const d = new Date();
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

function veventAllDay({ uid, dateStr, title, description }) {
  const day = dayOf(dateStr);
  if (day == null) return [];
  const lines = [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp()}`,
    `DTSTART;VALUE=DATE:${icsDay(day)}`,
    `DTEND;VALUE=DATE:${icsDay(day + 86400000)}`,
    `SUMMARY:${escapeText(title)}`,
    `DESCRIPTION:${escapeText(description)}`,
  ];
  for (const days of ALARM_DAYS) {
    lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapeText(title)}`, `TRIGGER:-P${days}D`, 'END:VALARM');
  }
  lines.push('END:VEVENT');
  return lines;
}

function wrapCalendar(eventLines) {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Cassetto//BFP//IT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...eventLines,
    'END:VCALENDAR',
  ]
    .map(foldLine)
    .join('\r\n') + '\r\n';
}

function bondEvents(bond, descrizioneScadenza, descrizionePrescrizione) {
  const nome = `buono ${bond.serie || ''} n. ${bond.numero || ''}`.replace(/\s+/g, ' ').trim();
  return [
    ...(bond.dataScadenza
      ? veventAllDay({
          uid: `${bond.id}-scadenza@cassetto`,
          dateStr: bond.dataScadenza,
          title: `Scadenza ${nome}`,
          description: descrizioneScadenza,
        })
      : []),
    ...(bond.dataPrescrizione
      ? veventAllDay({
          uid: `${bond.id}-prescrizione@cassetto`,
          dateStr: bond.dataPrescrizione,
          title: `Prescrizione ${nome}`,
          description: descrizionePrescrizione,
        })
      : []),
  ];
}

/** Importo nominale per il testo dei promemoria: "Nominale: L. 1.000.000 (≈ 516,46 €)". */
export function nominalText(bond) {
  const n = Number(bond.nominale);
  if (!Number.isFinite(n) || n <= 0) return '';
  const itl = normalizeValuta(bond.valuta) === 'ITL';
  return itl
    ? ` Nominale: ${formatMoney(n, 'ITL')} (circa ${formatEUR(nominaleEUR(bond))}).`
    : ` Nominale: ${formatMoney(n, 'EUR')}.`;
}

export function bondToICS(bond) {
  if (isRitirato(bond)) return wrapCalendar([]);
  return wrapCalendar(
    bondEvents(
      bond,
      `Promemoria scadenza per il buono fruttifero ${bond.numero || ''}.${nominalText(bond)}`,
      'Attenzione: oltre questa data il diritto al rimborso può prescriversi.'
    )
  );
}

export function portfolioToICS(bonds, portfolioName) {
  const desc = `Portafoglio: ${portfolioName || ''}`;
  return wrapCalendar(
    bonds.filter((b) => !isRitirato(b)).flatMap((bond) =>
      bondEvents(bond, `${desc}.${nominalText(bond)}`, `${desc}. Oltre questa data il diritto al rimborso può prescriversi.${nominalText(bond)}`)
    )
  );
}

export function downloadFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoca differita: alcuni browser (Safari/Firefox) annullano il download se si revoca subito.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function downloadICS(content, filename) {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  downloadFile(blob, filename.endsWith('.ics') ? filename : `${filename}.ics`);
}
