# Tax Automation Lab v6.13.0

**Data:** 26 luglio 2026

## Financial Statement v1.3.0

Recepito l’audit indipendente sulla v1.2.0. Lo schema ordinario è stato completato nelle voci mancanti dell’art. 2424 c.c. e il dettaglio entro/oltre l’esercizio successivo è ora gestito per categoria. Sono stati aggiunti migrazione dei mapping storici, controllo sulle formule Excel prive di valore memorizzato, protezione dalle importazioni mapping non sicure, isolamento fra identità societarie e stato esplicito dei salvataggi. La distribuzione resta online e tramite release GitHub.

## LIPE v3.4.0

Recepito l’audit indipendente sulla v3.3.0. L’XML IVP18 ora applica regole di presenza coerenti per i campi opzionali e rende mutuamente esclusivi IVA dovuta e IVA a credito. Il quarto trimestre dei trimestrali per opzione utilizza il codice 5 anche negli output. Rafforzati parser numerici e date, cambio periodo, riporti da storico finalizzato, cancellazione a cascata, gestione della quota browser e backup completo dell’archivio. La distribuzione è solo online.

## Nuovo tool: Financial Analysis & Reclassification v1.8.0

Pubblicato il nuovo strumento di analisi e riclassificazione gestionale. Parte da un bilancio civilistico verificato e integra schemi gestionali, KPI, DuPont, rendiconto finanziario, Budget, Forecast, centri di costo, benchmark, gate di controllo, reportistica e backup locale. Sono state create le rotte informative IT/EN/ES, la configurazione assistita e un approfondimento dedicato. La distribuzione è solo online.

## Sito e comunicazione

- suite aggiornata da tre a quattro strumenti;
- distinzione esplicita fra prospetto civilistico e analisi gestionale;
- pagine Strumenti, Home, Configura con AI e I casi aggiornate in italiano, inglese e spagnolo;
- privacy rafforzata: elaborazione sul dispositivo, persistenza nel browser e necessità di backup locale;
- manifest e sitemap aggiornati;
- GitHub mantenuto esclusivamente per Financial Statement.

## Compatibilità e migrazione

Gli archivi rimangono locali nel browser. I mapping Financial Statement precedenti vengono migrati verso le nuove voci di scadenza con una regola prudenziale e una segnalazione da verificare. Per LIPE i riporti automatici richiedono uno storico precedente finalizzato e coerente. Prima del deploy è raccomandata l’esportazione dei backup dai tool già utilizzati.
