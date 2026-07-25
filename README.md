# Tax Automation Lab

Pacchetto sito: **v6.10.0**

Portfolio personale dedicato all’automazione di processi fiscali e contabili.

## Strumenti disponibili

| Tool | Versione | Consultazione online |
|---|---:|---|
| TaxTool Financial Statement | 1.1.3 | https://taxautomationlab.com/tools/financial-statement/ |
| TaxTool TFA Client File | 1.6.3 | https://taxautomationlab.com/tools/tfa-client-file/ |
| TaxTool LIPE | 3.2.5 | https://taxautomationlab.com/tools/lipe/ |

I tool sono applicazioni HTML monofile utilizzabili localmente nel browser. I dati inseriti non vengono inviati al sito.

## Configurazione assistita dall’AI

La sezione `/configura-con-ai/` mette a disposizione, per gli strumenti supportati:

- template compatibili scaricabili;
- prompt guidati;
- indicazioni flessibili sui documenti utilizzabili;
- istruzioni visuali per il caricamento nei tool;
- obbligo di verifica professionale prima dell’importazione.

La formulazione del sito non dipende dal numero dei tool configurabili, così la sezione può essere estesa senza introdurre riferimenti numerici obsoleti.

## TFA Client File

TFA Client File v1.6.3 comprende:

- modalità Analitica predefinita per i nuovi fascicoli;
- importazione Excel di Anagrafica, Analitica e Commentary;
- sezione `Altro` per informazioni rilevanti non classificabili;
- anteprima prima dell’importazione;
- gestione più chiara di salvataggio, nuovo cliente, nuovo esercizio, archivio e backup;
- hotfix della libreria Excel incluso nella release v6.7.1.

## Guida

La guida “Automazione dei processi fiscali e contabili” è disponibile in PDF:

https://taxautomationlab.com/guide/

Nel sito l’etichetta pubblica è semplicemente **Guida**.

## Lingue e navigazione

Le pagine informative sono disponibili in italiano, inglese e spagnolo:

- Italiano: https://taxautomationlab.com/
- English: https://taxautomationlab.com/en/
- Español: https://taxautomationlab.com/es/

Le tre versioni utilizzano struttura, header, tipografia e gerarchia grafica coerenti. Le interfacce operative dei tool restano in italiano.

## Licenze

- Codice dei tool: MIT — `legal-docs/MIT.txt`
- Guida: CC BY-NC-ND 4.0 — `legal-docs/CC-BY-NC-ND-4.0.txt`
- Sito, testi, logo, fotografia e brand: tutti i diritti riservati
- Librerie incorporate: `legal-docs/THIRD-PARTY-NOTICES.txt`

## Sicurezza e privacy

I tool elaborano i documenti localmente nel browser. Il sito non utilizza Analytics né cookie pubblicitari.

## Distribuzione

- Sito: https://taxautomationlab.com
- Download ufficiali: https://github.com/zeddariccardo/tax-automation-lab/releases

## Contatti

- contact@taxautomationlab.com
- security@taxautomationlab.com

## Disclaimer

Tax Automation Lab è un progetto personale e indipendente, non approvato o sponsorizzato da terze parti. I contenuti, le opinioni e gli strumenti pubblicati non rappresentano terze parti.

## v6.10.0

- Financial Statement v1.1.3 con righe esplicite **Totale attivo** e **Totale passivo** in interfaccia, Excel, PDF sintetico/esteso/dettaglio e schema vuoto;
- controllo dei totali per periodo corrente e comparativo;
- etichette di esempio, export, backup e reset rese più esplicite;
- numerazione e claim dei tool resi più coerenti;
- articolo TFA ampliato con onboarding Excel AI e sezione Altro;
- badge versione e navigazione degli articoli uniformati.

- SheetJS CE aggiornato dalla versione 0.18.5 alla versione ufficiale 0.20.3 nei nove HTML operativi;
- regressione Excel completata in modalità locale e tramite server HTTP.

## v6.8.0

- header semplificato e uniforme in tutte le pagine;
- navigazione `Home · Configura con AI · Strumenti · I casi · Chi sono`;
- eliminazione della seconda navigazione mobile;
- homepage alleggerita con tre pannelli compatti e accenti differenziati;
- copy di configurazione reso generico e future-proof;
- riferimento a Goldman Sachs nel profilo professionale;
- footer e tipografia uniformati;
- screenshot TFA reali;
- TFA v1.6.1 e hotfix Excel integralmente inclusi.

Per i controlli eseguiti, vedere `QA-v6.8.0.json`.
