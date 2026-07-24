# Tax Automation Lab

Pacchetto sito: v6.7.0

Portfolio personale dedicato all’automazione di processi fiscali e contabili.

## Strumenti disponibili

| Tool | Versione | Consultazione online |
|---|---:|---|
| TaxTool Financial Statement | 1.1.1 | https://taxautomationlab.com/tools/financial-statement/ |
| TaxTool TFA Client File | 1.6.0 | https://taxautomationlab.com/tools/tfa-client-file/ |
| TaxTool LIPE | 3.2.3 | https://taxautomationlab.com/tools/lipe/ |

I tool sono applicazioni HTML monofile, utilizzabili localmente nel browser.
I dati inseriti non vengono inviati al sito.

## Guida

La guida “Automazione dei processi fiscali e contabili” è disponibile in PDF:

https://taxautomationlab.com/resources/Guida_Automazione_Processi_Fiscali_v4.pdf

## Licenze

- Codice dei tool: MIT — `legal-docs/MIT.txt`
- Guida: CC BY-NC-ND 4.0 — `legal-docs/CC-BY-NC-ND-4.0.txt`
- Sito, testi, logo, fotografia e brand: tutti i diritti riservati
- Librerie incorporate: `legal-docs/THIRD-PARTY-NOTICES.txt`

## Sicurezza e privacy

I tool elaborano i documenti localmente nel browser. Il sito non utilizza
Analytics né cookie pubblicitari.

## Distribuzione

- Sito: https://taxautomationlab.com
- Download ufficiali: https://github.com/zeddariccardo/tax-automation-lab/releases

## Contatti

- contact@taxautomationlab.com
- security@taxautomationlab.com

## Disclaimer

Tax Automation Lab è un progetto personale e indipendente, non approvato o
sponsorizzato da terze parti. I contenuti, le opinioni e gli strumenti
pubblicati non rappresentano terze parti.

## Lingue del sito

Le pagine informative sono disponibili in italiano, inglese e spagnolo:

- Italiano: https://taxautomationlab.com/
- English: https://taxautomationlab.com/en/
- Español: https://taxautomationlab.com/es/

Le interfacce operative dei tre tool restano in italiano.

Le versioni inglese e spagnola utilizzano la stessa struttura, lo stesso template e gli stessi controlli della versione italiana; cambiano esclusivamente testi, metadati SEO e destinazioni linguistiche.


## Onboarding assistito dall’AI

La sezione `/configura-con-ai/` mette a disposizione template compatibili, prompt guidati e istruzioni visive per preparare con un assistente AI:

- il file di importazione del Financial Statement;
- il codiciario IVA permanente del Generatore LIPE;
- il fascicolo TFA Client File, nelle viste Analitica e Commentary, con una sezione «Altro» per le informazioni rilevanti non classificabili.

Gli importi LIPE del singolo periodo restano separati e vengono caricati direttamente nel tool.


## Audit remediation

See `AUDIT-REMEDIATION.md` for the verified findings, corrections applied and deliberately deferred items.


## v6.6.0 — Unified navigation and streamlined homepage
- One responsive header across the site in IT, EN and ES.
- Navigation order: Home, AI configuration, Tools, Insights, About.
- Homepage tool and insight grids replaced by compact navigation panels.
- Public guide label standardised to “Guida” / “Guide” / “Guía”.
- Tool calculation, storage and import/export logic unchanged.


## v6.7.0 — TFA AI import and file management
- TFA Client File v1.6.0, con modalità Analitica predefinita per i nuovi fascicoli.
- Nuovo template Excel con fogli Istruzioni, Anagrafica, Analitica e Commentary.
- Importazione Excel con anteprima e scelta tra nuovo fascicolo e aggiornamento del fascicolo corrente.
- Compilazione contestuale delle viste Analitica e Commentary.
- Sezione «Altro» persistente per informazioni rilevanti non classificabili, inclusa negli export e nel riporto annuale.
- Gestione fascicolo, importazione ed esportazione rese più accessibili nella barra laterale e nella barra comandi.
- Nuova configurazione AI dedicata al TFA nelle versioni IT, EN ed ES.
