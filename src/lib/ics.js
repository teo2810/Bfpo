function pad(n) { return String(n).padStart(2, '0'); }

function toICSDate(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

function escapeText(s = '') {
  return String(s).replace(/([,;])/g, '\\$1').replace(/\n/g, '\\n');
}

function veventAllDay({ uid, dateStr, title, description, alarmsDays = [] }) {
  const dt = toICSDate(dateStr);
  const alarms = alarmsDays
    .map(
      (days) => `BEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:${escapeText(title)}
TRIGGER:-P${days}D
END:VALARM`
    )
    .join('\n');
  return `BEGIN:VEVENT
UID:${uid}
DTSTAMP:${toICSDate(new Date().toISOString())}T000000Z
DTSTART;VALUE=DATE:${dt}
DTEND;VALUE=DATE:${dt}
SUMMARY:${escapeText(title)}
DESCRIPTION:${escapeText(description)}
${alarms}
END:VEVENT`;
}

function wrapCalendar(events) {
  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Cassetto//BFP//IT
CALSCALE:GREGORIAN
${events.join('\n')}
END:VCALENDAR`;
}

export function bondToICS(bond) {
  const events = [];
  if (bond.dataScadenza) {
    events.push(
      veventAllDay({
        uid: `${bond.id}-scadenza@cassetto`,
        dateStr: bond.dataScadenza,
        title: `Scadenza buono ${bond.serie || ''} n. ${bond.numero || ''}`.trim(),
        description: `Promemoria scadenza per il buono fruttifero ${bond.numero || ''}.`,
        alarmsDays: [90, 60, 30, 7],
      })
    );
  }
  if (bond.dataPrescrizione) {
    events.push(
      veventAllDay({
        uid: `${bond.id}-prescrizione@cassetto`,
        dateStr: bond.dataPrescrizione,
        title: `Prescrizione buono ${bond.serie || ''} n. ${bond.numero || ''}`.trim(),
        description: `Attenzione: oltre questa data il diritto al rimborso può prescriversi.`,
        alarmsDays: [90, 60, 30, 7],
      })
    );
  }
  return wrapCalendar(events);
}

export function portfolioToICS(bonds, portfolioName) {
  const events = bonds.flatMap((bond) => {
    const list = [];
    if (bond.dataScadenza) {
      list.push(
        veventAllDay({
          uid: `${bond.id}-scadenza@cassetto`,
          dateStr: bond.dataScadenza,
          title: `Scadenza buono ${bond.serie || ''} n. ${bond.numero || ''}`.trim(),
          description: `Portafoglio: ${portfolioName || ''}`,
          alarmsDays: [90, 60, 30, 7],
        })
      );
    }
    if (bond.dataPrescrizione) {
      list.push(
        veventAllDay({
          uid: `${bond.id}-prescrizione@cassetto`,
          dateStr: bond.dataPrescrizione,
          title: `Prescrizione buono ${bond.serie || ''} n. ${bond.numero || ''}`.trim(),
          description: `Portafoglio: ${portfolioName || ''}`,
          alarmsDays: [90, 60, 30, 7],
        })
      );
    }
    return list;
  });
  return wrapCalendar(events);
}

export function downloadICS(content, filename) {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.ics') ? filename : `${filename}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
