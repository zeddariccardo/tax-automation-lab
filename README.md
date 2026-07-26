# Tax Automation Lab

Pacchetto sito: **v6.13.0** — 26 luglio 2026

Portfolio personale dedicato all’automazione dei processi fiscali, contabili e di analisi finanziaria. Il sito è pubblicato in italiano, inglese e spagnolo; le interfacce operative dei tool restano in italiano.

## Strumenti disponibili

| Tool | Versione | Distribuzione |
|---|---:|---|
| Riclassifica IV Direttiva / Financial Statement | 1.3.0 | Online e release GitHub |
| Financial Analysis & Reclassification | 1.8.0 | Solo online |
| TFA Client File | 1.7.0 | Solo online |
| Generatore LIPE | 3.4.0 | Solo online |

Rotte principali:

- `https://taxautomationlab.com/tools/financial-statement/`
- `https://taxautomationlab.com/tools/financial-analysis/`
- `https://taxautomationlab.com/tools/tfa-client-file/`
- `https://taxautomationlab.com/tools/lipe/`

## Distinzione tra i tool finanziari

**Financial Statement** riclassifica i conti nello schema civilistico della IV Direttiva e produce il prospetto di bilancio. **Financial Analysis & Reclassification** parte invece da dati contabili già verificati per costruire riclassificazioni gestionali, KPI, analisi DuPont, rendiconto finanziario, Budget e Forecast, centri di costo, benchmark e reportistica direzionale.

## Configurazione assistita dall’AI

La sezione `/configura-con-ai/` contiene template compatibili, prompt guidati, esempi e istruzioni di caricamento. I template devono essere verificati dall’utente prima dell’importazione: l’assistenza AI non sostituisce i controlli contabili, fiscali o dichiarativi.

## Financial Statement v1.3.0

- schema ordinario completato nelle voci oggetto di audit;
- dettaglio entro/oltre l’esercizio successivo gestito per categoria;
- migrazione prudenziale dei mapping creati con versioni precedenti, con avviso di verifica;
- formule Excel prive di valore memorizzato bloccate;
- import mapping reso più sicuro e output testuali protetti;
- isolamento dei dati al cambio dell’identità societaria;
- stato di salvataggio e gestione degli errori di memoria locale resi espliciti.

## Financial Analysis & Reclassification v1.8.0

- import unico e mapping dei conti;
- schemi di riclassificazione gestionale;
- KPI economici, patrimoniali e finanziari;
- analisi DuPont e bridge delle variazioni;
- rendiconto finanziario e controlli di riconciliazione;
- Budget, Forecast, centri di costo, benchmark e rettifiche;
- gate di qualità, salvataggio locale e backup JSON.

## TFA Client File v1.7.0

- salvataggi verificati e protezione del lavoro non archiviato;
- identificativo cliente stabile;
- backup e ripristino dell’archivio;
- ricerca globale, checklist iniziale e anteprima dell’import Excel;
- validazioni su anno, numeri e struttura dei fogli.

## LIPE v3.4.0

- parser più rigorosi per importi, date, periodo e mapping;
- separazione dei workspace per cliente, anno, periodo e regime;
- riporti automatici subordinati a uno storico precedente finalizzato e coerente;
- quarto trimestre per opzione con codice trimestre `5` negli output;
- XML con IVA dovuta e IVA a credito mutuamente esclusivi;
- campi opzionali XML serializzati solo nei periodi ammessi;
- cancellazione a cascata, stato dei salvataggi e backup completo dell’archivio.

**Gate esterno obbligatorio:** prima di qualsiasi invio, il file XML LIPE deve essere verificato con il modulo di controllo ufficiale dell’Agenzia delle Entrate e riesaminato da un professionista responsabile.

## Privacy, persistenza e backup

L’elaborazione avviene interamente sul dispositivo dell’utente. I file e i dati non vengono caricati, trasmessi o conservati su server o servizi online dal sito o dai tool.

La memoria di lavoro è salvata nel browser del singolo dispositivo. Cambiando computer o browser, usando la navigazione privata, cancellando cache/dati del sito o raggiungendo i limiti di archiviazione, i dati possono andare persi. È quindi necessario esportare periodicamente i backup locali disponibili nei tool prima di chiudere o cambiare ambiente di lavoro.

Il sito non utilizza Analytics né cookie pubblicitari.

## Guida

La guida “Automazione dei processi fiscali e contabili” è disponibile alla rotta `/guide/`.

## Licenze

- Codice dei tool: MIT — `legal-docs/MIT.txt`
- Guida: CC BY-NC-ND 4.0 — `legal-docs/CC-BY-NC-ND-4.0.txt`
- Sito, testi, logo, fotografia e brand: tutti i diritti riservati
- Librerie incorporate: `legal-docs/THIRD-PARTY-NOTICES.txt`

## Distribuzione

Il sito completo viene distribuito come pacchetto di produzione. Le release GitHub pubbliche devono contenere esclusivamente il Financial Statement e i relativi materiali; LIPE, TFA Client File e Financial Analysis restano disponibili solo online.

## Contatti

- `contact@taxautomationlab.com`
- `security@taxautomationlab.com`

## Disclaimer

Tax Automation Lab è un progetto personale e indipendente, non approvato o sponsorizzato da terze parti. I contenuti, le opinioni e gli strumenti pubblicati non rappresentano terze parti e non sostituiscono la valutazione professionale sul caso concreto.
