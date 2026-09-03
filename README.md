# Cassetto

PWA locale-first per indicizzare Buoni Fruttiferi Postali cartacei (e titoli simili): stima il valore, avvisa su scadenze e prescrizione (scadenza + 10 anni). Nessun account, nessun backend: tutto vive in IndexedDB sul tuo dispositivo.

**Cassetto non è Poste Italiane né un consulente finanziario.** Ogni valore mostrato è una stima. La fonte di verità resta il titolo cartaceo e Poste Italiane.

## Avvio in locale

```bash
npm i
npm run dev
```

Apri l'indirizzo mostrato in terminale (di solito http://localhost:5173).

Per una build di produzione:

```bash
npm run build
npm run preview   # per testare la build in locale
```

## Struttura

```
src/
  lib/        db.js (IndexedDB/idb), quote.js (stima pura), ics.js, backup.js, reminders.js, seed.js
  data/       series.json — catalogo locale delle serie BFP note
  components/ TabBar (dock con bead animata), Fab, icone, Disclaimer
  screens/    Home, Bond, AddBond, Portfolios, Charts, Settings
  styles/     tokens.css (temi), global.css, dock.css
public/
  manifest.webmanifest, sw.js (service worker), icons/
```

## Limiti dei promemoria

I promemoria (soglie 90/60/30/7 giorni su scadenza e prescrizione) sono **best-effort**:

- vengono controllati quando apri l'app, quando torna in primo piano (`visibilitychange`) e, se il
  browser lo supporta, tramite Periodic Background Sync;
- **non esiste una sveglia che scatta ad app chiusa**: nessun browser lo garantisce senza un
  server push, che questo progetto volutamente non ha (niente backend, v1 offline-first);
- se non apri Cassetto per molto tempo, la Home mostra un banner "Cassetto non verificato" dopo
  90 giorni di inattività;
- per non perdere una scadenza puoi comunque esportare i promemoria come file **.ics** (per singolo
  buono o per tutti) e importarli nel tuo calendario di sistema, che ha notifiche reali.

## Backup

Impostazioni → Backup. Un solo file JSON con tutti i buoni e portafogli (il seed dimostrativo non
viene mai incluso). Password di cifratura opzionale (AES-GCM via WebCrypto): se la imposti, il file
esportato è cifrato e serve la stessa password per reimportarlo.

**Senza un export, i dati spariscono se cancelli i dati del sito, disinstalli l'app o cambi
dispositivo.** Non c'è cloud né account.

## OCR / Scansione

La schermata "Aggiungi" ha un pulsante "Scansiona il titolo" che apre la fotocamera o la galleria,
ma è uno **stub**: non fa OCR reale, apre solo il selettore di file e poi chiede di compilare i
campi manualmente. È pensato come punto di innesto per un OCR reale in una versione futura.

## Pubblicare su GitHub Pages

1. Crea un repository su GitHub e carica questo progetto (`git init`, `git add .`, `git commit`,
   `git remote add origin <url>`, `git push`).
2. `vite.config.js` usa già `base: './'`, quindi i percorsi restano relativi e funzionano sia in
   root sia in una sottocartella tipo `https://tuonome.github.io/cassetto/`.
3. Build: `npm run build` genera la cartella `dist/`.
4. Pubblica `dist/` su Pages, ad esempio con l'azione ufficiale `actions/deploy-pages`, oppure
   manualmente:
   ```bash
   npm run build
   npx gh-pages -d dist
   ```
   (richiede `npm i -D gh-pages` la prima volta, e che il repo abbia Pages abilitato sul branch
   `gh-pages`).
5. Apri l'URL di Pages da un telefono e usa "Aggiungi a schermata Home" per installarla come app.

## Fuori scope (v1)

Backend, login, sync cloud, OCR reale, integrazione API Poste, push notification via server.
