# Test report — v6.15.6

## Verifiche eseguite

- Controllo sintattico JavaScript della hotfix con `node --check`: superato.
- Generazione di un workbook reale tramite SheetJS con `type: "array"`: superata.
- Normalizzazione del risultato in `Uint8Array`: superata.
- Verifica dei primi quattro byte `80, 75, 3, 4` (`PK\x03\x04`): superata.
- Apertura del pacchetto come archivio ZIP e presenza di `[Content_Types].xml` e `xl/workbook.xml`: superata.
- Riapertura del file con OpenPyXL, lettura del foglio e del valore numerico di prova: superata.
- Applicazione automatica della patch su tre copie simulate del tool: superata.
- Seconda applicazione idempotente senza duplicare la patch: superata.
- Ripristino automatico dai backup: superato.

## Verifica da completare dopo il deploy

Eseguire nel browser il caso ON GROUP allegato dall’utente, scaricare il report e aprirlo con Microsoft Excel. Questo controllo richiede la versione pubblicata del tool e deve essere svolto dopo GitHub Pages e Cloudflare purge.
