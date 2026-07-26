# Azioni successive al deploy v6.13.0

## Prima del deploy

1. Esportare un backup locale dagli strumenti già utilizzati, in particolare Financial Statement, LIPE, TFA Client File e Financial Analysis.
2. Conservare una copia del pacchetto v6.12.0 e dell’ultimo commit pubblicato per consentire un rollback immediato.
3. Verificare che il deploy utilizzi il contenuto della cartella radice del pacchetto di produzione e non una cartella contenitore aggiuntiva.

## Deploy del sito

1. Caricare il pacchetto v6.13.0 nel repository e controllare il riepilogo delle modifiche prima del commit.
2. Attendere il completamento positivo di GitHub Actions.
3. Verificare il dominio in produzione e, solo dopo il deploy, eseguire il purge della cache Cloudflare.
4. Aprire il sito in una finestra anonima e controllare Home, Strumenti, Configura con AI, I casi, Chi sono, Privacy e le versioni IT/EN/ES.
5. Controllare le nuove rotte:
   - `/tools/financial-analysis/`
   - `/approfondimenti/analisi-e-riclassificazione-bilancio/`
   - `/en/tools/financial-analysis/`
   - `/en/insights/financial-analysis-and-reclassification/`
   - `/es/tools/financial-analysis/`
   - `/es/analisis/analisis-y-reclasificacion-financiera/`

## Smoke test dei tool

1. **Financial Statement v1.3.0:** importare il caso di prova, verificare mapping, voci entro/oltre, quadrature, comparativo, PDF, Excel, migrazione di un mapping precedente e backup.
2. **Financial Analysis v1.8.0:** importare il file unico, verificare anagrafica, mapping, schemi, KPI, DuPont, rendiconto finanziario, Budget/Forecast, backup JSON e recupero del salvataggio locale.
3. **TFA Client File v1.7.0:** verificare anteprima import, badge di stato, ricerca, salvataggio, archivio, ripristino e protezione del lavoro non archiviato.
4. **LIPE v3.4.0:** verificare mensile, trimestrale ordinario e trimestrale per opzione; controllare riporti, PDF, Excel, XML, cambio periodo, backup e ripristino.
5. Aprire la console del browser durante ogni prova: non devono comparire errori JavaScript rossi.

## Controllo dichiarativo LIPE

Il superamento dei test interni non equivale alla conformità dichiarativa ufficiale. Prima dell’utilizzo operativo:

1. validare ogni XML con il modulo di controllo ufficiale dell’Agenzia delle Entrate;
2. confrontare i valori VP con la liquidazione IVA e la documentazione contabile;
3. verificare manualmente regime, periodo, riporti, acconto e campi condizionati;
4. conservare evidenza della validazione e dell’approvazione del responsabile.

## Release GitHub

Creare la release GitHub `v6.13.0` solo dopo il collaudo del sito. Pubblicare esclusivamente gli asset dedicati al **Financial Statement v1.3.0**. LIPE, TFA Client File e Financial Analysis non devono essere allegati né resi scaricabili da GitHub.

## Indicizzazione e monitoraggio

1. Verificare `sitemap.xml` e richiederne una nuova lettura in Google Search Console e Bing Webmaster Tools.
2. Controllare le pagine principali con ispezione URL.
3. Verificare responsive, intestazioni di sicurezza, favicon e assenza di link interrotti dopo il purge.
4. Monitorare per alcuni giorni eventuali errori di navigazione o segnalazioni degli utenti, senza modificare direttamente la release già validata: eventuali correzioni devono confluire in una nuova versione.
