# Tax Automation Lab v6.7.0

Data: 24 luglio 2026

## Contenuto della release

### TFA Client File v1.6.0
- Modalità Analitica come impostazione iniziale dei nuovi fascicoli.
- Template Excel TFA con quattro fogli: `Istruzioni`, `Anagrafica`, `Analitica`, `Commentary`.
- Importazione del file Excel con validazione, anteprima e report delle anomalie.
- Importazione contemporanea delle viste Analitica e Commentary; lo switch cambia la vista senza perdere i dati.
- Scelta esplicita tra creazione di un nuovo fascicolo e aggiornamento di quello corrente.
- Sezione `Altro` / `miscItems` per le informazioni rilevanti non classificabili con sufficiente affidabilità.
- Trasferimento automatico in `Altro` dei codici o delle sezioni non riconosciuti, senza scartare informazioni.
- Fonte, stato di verifica e note conservati nei record importati.
- Gestione più chiara di salvataggio, nuovo cliente, nuovo esercizio, archivio, importazione ed export.
- Compatibilità conservata con fascicoli e backup JSON delle versioni precedenti.

### Sito v6.7.0
- Terza configurazione AI dedicata al TFA nelle pagine italiana, inglese e spagnola.
- Download diretto del template TFA e prompt guidato.
- Nuove istruzioni visive sul punto di caricamento e sull’anteprima dell’importazione.
- Versioni e metadati aggiornati a TFA v1.6.0.

## Elementi non modificati
- Logiche fiscali e di calcolo già presenti.
- Funzioni IRL, export Excel/PDF/JSON/HTML e archivio locale.
- Financial Statement v1.1.1 e LIPE v3.2.3.
- Percorsi pubblici, header unificato e struttura multilingua della v6.6.0.

## Nota di sicurezza
La libreria SheetJS incorporata resta quella della release precedente. Il suo aggiornamento a 0.20.3 richiede una sostituzione verificata del bundle ufficiale e una batteria separata di test di regressione su tutti i tool che leggono o scrivono Excel.
