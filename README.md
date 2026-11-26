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

## Stima del valore

Se indichi nominale, date e valore a scadenza, Cassetto stima il valore di oggi a
capitalizzazione composta con tasso medio costante: `V(t) = N · (VS/N)^(t/T)` (t = giorni
trascorsi dall'emissione, T = durata). Dopo la scadenza il valore resta quello a scadenza. Senza
valore a scadenza mostra il nominale. Mostra anche il tasso medio annuo implicito.

## Aggiornamenti (service worker)

`public/sw.js` ha una versione di cache (`cassetto-vN`) da aumentare a ogni rilascio. Non usa
`skipWaiting` né ricarica la pagina: la nuova versione si attiva al successivo avvio dell'app.
Le navigazioni sono network-first (l'index in cache serve solo offline), gli asset con hash
cache-first. `public/assets/index-*.js` sono stub per i bundle di versioni già pubblicate: se un
service worker vecchio serve un index in cache che li richiede, lo stub rimuove SW e cache e
ricarica una sola volta, invece di lasciare la pagina bianca. Aggiungi qui l'hash del bundle
attuale prima di pubblicare una versione nuova.

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

Il workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) pubblica `dist/` a ogni push su `main` (Node 22: Vite 8 richiede `^20.19` oppure `>=22.12`).

1. Su GitHub: Settings → Pages → Build and deployment → Source: **GitHub Actions**.
2. Fai push su `main`. L'azione fa `npm ci`, `npm run build` e `deploy-pages`.
3. `vite.config.js` usa `base: './'`, quindi l'app funziona nella sottocartella `https://tuonome.github.io/<repo>/`.
4. Apri l'URL di Pages dal telefono e usa «Aggiungi a schermata Home».

In locale, per provare la build: `npm run build && npm run preview`.

## Fuori scope (v1)

Backend, login, sync cloud, OCR reale, integrazione API Poste, push notification via server.

## Buoni in lire

Ogni buono ha una valuta (euro o lire). Per i buoni in lire nominale e valore a scadenza si inseriscono in lire
(numeri interi) e vengono convertiti in euro al cambio fisso 1936,27 lire/€; totali, grafici e somme dei portafogli
sono sempre in euro. Le stime restano indicative («stima»): nessuna tabella di tassi è inventata.

## Sincronizzazione facoltativa con Google Sheet

Cassetto resta locale (IndexedDB, funziona offline). Chi vuole può collegare un proprio Google Sheet tramite
una web app di Apps Script: segui i 5 passi nell'intestazione di `apps-script/Code.gs`, poi incolla URL e chiave
in Impostazioni > Sincronizzazione Google Sheet. URL e chiave restano solo nel dispositivo (localStorage), mai
nei backup né nel repository. Ogni record ha `updatedAt`: vince la modifica più recente (last-write-wins) e le
cancellazioni sono lapidi (`deleted: true`). La sincronizzazione parte con il pulsante, all'apertura, al ritorno
online e (con attesa di pochi secondi) dopo ogni modifica.
