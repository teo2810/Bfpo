/**
 * Cassetto — sincronizzazione facoltativa con Google Sheet (web app di Apps Script)
 *
 * COME ATTIVARLA (5 passi, circa 5 minuti):
 *   1. Crea lo Sheet: vai su sheets.google.com e crea un foglio nuovo e vuoto (es. «Cassetto»).
 *   2. Apri Estensioni > Apps Script.
 *   3. Incolla il codice: cancella quello che c'è e incolla tutto questo file, poi salva.
 *   4. Imposta la chiave: Impostazioni progetto (icona ingranaggio) > Proprietà dello script >
 *      Aggiungi proprietà: nome CASSETTO_KEY, valore = una chiave lunga a tua scelta
 *      (almeno 8 caratteri; la stessa che inserirai in Cassetto).
 *   5. Distribuisci come app web: Distribuisci > Nuova distribuzione > tipo «App web»,
 *      Esegui come: me, Chi ha accesso: chiunque. Autorizza quando richiesto e copia l'URL
 *      che finisce con /exec.
 *
 * Poi, in Cassetto: Impostazioni > Sincronizzazione Google Sheet, incolla URL e chiave.
 * Se modifichi il codice dovrai creare una nuova versione della distribuzione.
 *
 * COME FUNZIONA
 *  - I dati restano anche sul dispositivo (IndexedDB): l'app funziona offline e sincronizza
 *    quando può. Lo Sheet è una copia condivisa tra i tuoi dispositivi.
 *  - Ogni record ha un campo updatedAt; in caso di conflitto vince il più recente
 *    (last-write-wins). Le cancellazioni sono «lapidi» (Eliminato = TRUE).
 *  - La chiave viene controllata qui sul server a ogni richiesta; senza chiave
 *    corretta non viene letto né scritto nulla. «Chiunque» riguarda solo l'accesso
 *    all'URL: senza la chiave nessuno può leggere i tuoi dati.
 *  - Fogli creati automaticamente: «Buoni» e «Portafogli». La colonna JSON contiene il
 *    record completo (valuta EUR/ITL compresa); le altre colonne sono solo per leggere.
 *    Non modificare a mano le colonne ID, Aggiornato, Eliminato e JSON.
 */

var CS_API = 1;
var CS_MAX_BODY = 2000000;
var CS_MAX_RECORDS = 10000;
var CS_MAX_JSON = 40000;
var CS_KINDS = {
  bonds: {
    sheet: 'Buoni',
    head: ['ID', 'Aggiornato', 'Eliminato', 'Valuta', 'Serie', 'Numero', 'Nominale', 'Valore a scadenza', 'Scadenza', 'Prescrizione', 'Intestatari', 'Rimborsato', 'Data rimborso', 'Importo incassato', 'JSON'],
    cols: function (r) {
      return [r.valuta === 'ITL' ? 'ITL' : 'EUR', r.serie, r.numero, r.nominale, r.valoreScadenza, r.dataScadenza, r.dataPrescrizione,
        Array.isArray(r.intestatari) ? r.intestatari.join(', ') : r.intestatari,
        r.rimborsato ? 'TRUE' : 'FALSE', r.dataRimborso || '', r.rimborsato ? r.importoIncassato : ''];
    }
  },
  portfolios: {
    sheet: 'Portafogli',
    head: ['ID', 'Aggiornato', 'Eliminato', 'Nome', 'Colore', 'JSON'],
    cols: function (r) { return [r.nome, r.colore]; }
  }
};

// ---------- risposte ----------
function cs_reply_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** GET: solo un controllo di vita (aprendo l'URL nel browser). Non restituisce dati. */
function doGet() {
  return cs_reply_({ ok: true, app: 'cassetto', api: CS_API, message: 'Cassetto sync attivo. Inserisci questo URL in Cassetto > Impostazioni.' });
}

function doPost(e) {
  var lock = LockService.getScriptLock(), held = false;
  try {
    var raw = e && e.postData && e.postData.contents ? String(e.postData.contents) : '';
    if (!raw || raw.length > CS_MAX_BODY) throw new Error('Richiesta vuota o troppo grande.');
    var req;
    try { req = JSON.parse(raw); } catch (err) { throw new Error('Richiesta non valida.'); }
    cs_auth_(req);
    if (req.action === 'ping') return cs_reply_({ ok: true, api: CS_API, bonds: [], portfolios: [] });
    if (req.action !== 'sync') throw new Error('Operazione non valida.');
    var incoming = {};
    Object.keys(CS_KINDS).forEach(function (kind) {
      var list = req[kind];
      if (list == null) list = [];
      if (!Array.isArray(list) || list.length > CS_MAX_RECORDS) throw new Error('Elenco «' + kind + '» non valido.');
      incoming[kind] = list.map(cs_clean_).filter(Boolean);
    });
    lock.waitLock(20000); held = true;
    var out = { ok: true, api: CS_API, now: new Date().toISOString() };
    Object.keys(CS_KINDS).forEach(function (kind) {
      var sheet = cs_sheet_(kind);
      var merged = cs_merge_(cs_read_(sheet), incoming[kind]);
      cs_write_(sheet, kind, merged.list);
      out[kind] = merged.list.map(function (r) { return r.rec; });
    });
    SpreadsheetApp.flush();
    return cs_reply_(out);
  } catch (err) {
    return cs_reply_({ ok: false, error: String(err && err.message ? err.message : err) });
  } finally {
    if (held) lock.releaseLock();
  }
}

// ---------- autenticazione ----------
function cs_auth_(req) {
  var key = PropertiesService.getScriptProperties().getProperty('CASSETTO_KEY');
  if (!key || key.length < 8) throw new Error('Chiave non impostata nello script: aggiungi CASSETTO_KEY in Proprietà dello script (passo 4).');
  var given = String(req && req.key || '');
  // Confronto a tempo costante rispetto alla lunghezza della chiave.
  var diff = given.length ^ key.length;
  for (var i = 0; i < key.length; i++) diff |= key.charCodeAt(i) ^ (given.charCodeAt(i) || 0);
  if (diff !== 0) throw new Error('Chiave di accesso errata.');
}

// ---------- logica di unione (last-write-wins) ----------
function cs_time_(iso) {
  var t = Date.parse(iso);
  return isNaN(t) ? 0 : t;
}

/** Valida un record in ingresso; scarta quelli malformati. */
function cs_clean_(rec) {
  if (!rec || typeof rec !== 'object' || Array.isArray(rec)) return null;
  if (typeof rec.id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(rec.id)) return null;
  var at = typeof rec.updatedAt === 'string' && cs_time_(rec.updatedAt) ? rec.updatedAt : '1970-01-01T00:00:00.000Z';
  if (rec.deleted === true) return { id: rec.id, updatedAt: at, deleted: true, rec: { id: rec.id, updatedAt: at, deleted: true } };
  var copy = JSON.parse(JSON.stringify(rec));
  copy.updatedAt = at;
  delete copy.deleted;
  if (JSON.stringify(copy).length > CS_MAX_JSON) return null;
  return { id: rec.id, updatedAt: at, deleted: false, rec: copy };
}

/** Il record `inc` sostituisce `cur`? Più recente vince; a parità vince la lapide. */
function cs_wins_(cur, inc) {
  if (!cur) return true;
  var a = cs_time_(cur.updatedAt), b = cs_time_(inc.updatedAt);
  if (a !== b) return b > a;
  return inc.deleted && !cur.deleted;
}

/** Unisce le righe esistenti con quelle in ingresso. Ritorna {list, changed}. */
function cs_merge_(existing, incoming) {
  var map = {}, order = [], changed = 0;
  existing.forEach(function (r) { if (!map[r.id]) order.push(r.id); map[r.id] = r; });
  incoming.forEach(function (r) {
    var cur = map[r.id];
    if (cs_wins_(cur, r)) {
      if (!cur) order.push(r.id);
      map[r.id] = r;
      changed++;
    }
  });
  return { list: order.map(function (id) { return map[id]; }), changed: changed };
}

// ---------- Sheet ----------
function cs_book_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
    if (!id) throw new Error('Script non collegato a uno Sheet: crealo da Estensioni > Apps Script dentro il foglio (passo 2).');
    ss = SpreadsheetApp.openById(id);
  }
  return ss;
}

/** Allinea l'intestazione: su fogli esistenti inserisce le colonne nuove subito prima di JSON. */
function cs_ensure_head_(sheet, def) {
  var want = def.head;
  if (sheet.getLastRow() < 1) {
    sheet.getRange(1, 1, 1, want.length).setValues([want]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    return;
  }
  var width = Math.max(sheet.getLastColumn(), 1);
  var have = sheet.getRange(1, 1, 1, width).getValues()[0].map(function (c) { return String(c || ''); });
  while (have.length && have[have.length - 1] === '') have.pop();
  if (!have.length) {
    sheet.getRange(1, 1, 1, want.length).setValues([want]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    return;
  }
  var same = have.length === want.length;
  if (same) {
    for (var i = 0; i < want.length; i++) if (have[i] !== want[i]) { same = false; break; }
  }
  if (same) return;
  var jsonIdx = -1;
  for (var j = 0; j < have.length; j++) if (have[j] === 'JSON') jsonIdx = j;
  if (jsonIdx < 0) return;
  var present = {};
  have.forEach(function (c) { present[c] = true; });
  var missing = [];
  for (var k = 0; k < want.length - 1; k++) if (!present[want[k]]) missing.push(want[k]);
  if (missing.length) {
    sheet.insertColumnsBefore(jsonIdx + 1, missing.length);
    sheet.getRange(1, jsonIdx + 1, 1, missing.length).setValues([missing]).setFontWeight('bold');
  }
  sheet.setFrozenRows(1);
}

function cs_sheet_(kind) {
  var def = CS_KINDS[kind], ss = cs_book_();
  var sh = ss.getSheetByName(def.sheet) || ss.insertSheet(def.sheet);
  cs_ensure_head_(sh, def);
  return sh;
}

function cs_read_(sheet) {
  var n = sheet.getLastRow();
  if (n < 2) return [];
  var width = sheet.getLastColumn();
  var rows = sheet.getRange(2, 1, n - 1, width).getValues();
  var out = [];
  rows.forEach(function (row) {
    var id = String(row[0] || '');
    var json = String(row[width - 1] || '');
    if (!id || !json) return;
    var rec;
    try { rec = JSON.parse(json); } catch (err) { return; }
    var clean = cs_clean_(rec);
    if (clean && clean.id === id) out.push(clean);
  });
  return out;
}

/** Evita che una cella venga interpretata come formula. */
function cs_cell_(v) {
  if (v == null) return '';
  var s = String(v);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function cs_write_(sheet, kind, list) {
  var def = CS_KINDS[kind], width = def.head.length;
  var rows = list.map(function (r) {
    var cols = r.deleted ? def.cols({}).map(function () { return ''; }) : def.cols(r.rec).map(cs_cell_);
    return [r.id, r.updatedAt, r.deleted ? 'TRUE' : 'FALSE'].concat(cols, [JSON.stringify(r.rec)]);
  });
  var last = sheet.getLastRow();
  if (last > 1) sheet.getRange(2, 1, last - 1, width).clearContent();
  if (rows.length) sheet.getRange(2, 1, rows.length, width).setNumberFormat('@').setValues(rows);
}
