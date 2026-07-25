# Tax Automation Lab — v6.7.1

Data: 24 luglio 2026

## Hotfix importazione Excel

- Ripristinata la libreria Excel incorporata nel TFA Client File.
- Corretto un errore di build che aveva inserito il CSS della v1.6.0 dentro una stringa JavaScript della libreria SheetJS, impedendone l'esecuzione.
- TFA Client File aggiornato alla v1.6.1.
- Nessuna modifica al modello dati, ai file di importazione, alle modalità Analitica e Commentary, alla sezione Altro o alle funzioni di salvataggio ed esportazione.
- Financial Statement v1.1.1 e LIPE v3.2.3 verificati e lasciati invariati.

## Test

- Sintassi della libreria SheetJS verificata nei tre tool.
- Disponibilità di `window.XLSX` verificata in Chromium.
- Lettura dei template Excel Financial Statement, LIPE e TFA verificata.
- Import TFA del file di prova verificato fino alla generazione dell'anteprima.
