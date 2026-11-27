# Tabelle tassi dei BFP ordinari cartacei

**Unico punto di verità:** le tabelle vivono in `series.json`, sotto `ordinario.tabelleTassi`.
Per correggere un tasso, una data di emissione o un flag, modifica solo quel file: il calcolo in `src/lib/tassi.js` lo legge da lì. Questo foglio è solo documentazione.

Tassi in forma decimale (0.08 = 8%). Scaglioni: anni 1–5, 6–10, 11–15, 16–20, poi 21–30.

## Convenzione di calcolo

Fonte: Poste Italiane, *Storico dei tassi applicati sui Buoni Fruttiferi Postali «ORDINARI» (emessi fino al 27 dicembre 2000)*, edizione settembre 2017:
https://www.media.poste.it/2c626a71-3e8c-482b-a0e8-a81762655ebd/web/storico-buoni-ordinari-30anni

- Dal 1° al 20° anno: interessi su **base bimestrale** in capitalizzazione **semplice** (1/6 del tasso annuo lordo per ogni bimestre compiuto dalla data di emissione) e **capitalizzati ogni anno** in regime composto.
- Nessun interesse se il rimborso avviene prima del compimento del primo anno.
- Dal 21° al 30° anno: interesse **semplice** bimestrale sul montante maturato al 20° anno.
  - Serie **Q e R**: al **tasso massimo** dello scaglione (12% Q, 11,5% R) fino all’anniversario del 30° anno.
  - Serie **S–Z**: al **0,50%** fino al **31/12 dell’anno di emissione + 30**.
- Ritenuta / imposta sostitutiva: **12,5%** sugli interessi.
- Capitalizzazione annuale **al netto** della ritenuta per Q e R (e per la serie S emessa fino al 31/12/1996); **al lordo** dalla serie T in poi (e per S dal 1/1/1997). Fonte: D.M. 23 giugno 1997, G.U. 24/06/1997 n. 145, art. 7 (cod. 097A5032). Conferma per U e Y: G.U. 31/12/1997 (97A10481) e 04/03/2000 (000A2381).

Il valore a scadenza inserito nel buono, se presente, **resta prioritario**: le tabelle si usano solo quando manca. I buoni **Dedicati ai Minori** non usano queste tabelle.

## Origine dei numeri

- **Q, T, U, W, X, Y, Z**: retri dei titoli (confermati anche dalla tabella Poste 2017).
- **S 5,5 / 6,5 / 7,5 / 9**: confermato da Matteo e allineato alla tabella Poste 2017.
- **R 7 / 8 / 9 / 11,5**: letto dalle scansioni e allineato alla tabella Poste 2017. L’**ultimo scaglione (11,5%, anni 16–20 e 21–30) è da verificare** (potrebbe essere 10,5%): in `series.json` ha `"daVerificare": true` e l’app lo segnala in interfaccia.
- **V**: non è sui retri elencati da Matteo; è nella tabella Poste 2017 (3,5 / 4,15 / 4,75 / 6 / 0,50), inclusa per il riconoscimento automatico dalla data di emissione.

Periodi di emissione: stessa tabella Poste 2017.

Per un modulo **sovratimbrato** (es. modulo Q timbrato R) si imposta il campo `tabellaTassi` sul buono: prevale sulla serie/data.
