# Handoff Codex → Claude — Tax Automation Lab

Data: 21 agosto 2026  
Repository: `zeddariccardo/tax-automation-lab`  
Sito: <https://taxautomationlab.com/>  

## Perimetro del passaggio

La baseline di Claude è stata ricostruita dalla cronologia Git nel commit `a262962`. Da quel punto Codex ha pubblicato tre commit su `main`; lo stato finale è `291d790`, allineato a `origin/main`.

## Interventi eseguiti

### 1. Audit Financial Analysis e LIPE — `9a5f551`

- **Financial Analysis:** corretti COGS e margine lordo; benchmark mostrato solo con copertura dati completa; “Adeguati assetti” rinominato e delimitato come **Diagnostica crisi e continuità**; migliorati menu mobile, navigazione, hash e accessibilità delle righe espandibili.
- **LIPE:** allineata la versione a `3.6.1`; corretto il nodo XML VP10; gestite le regole Q4 per VP11/VP12/VP14, la soglia storica VP7, `FlagConferma`, identificativo trasmittente e nomenclatura file; bloccato l’XML per strutture multi-modulo non supportate; marcato il PDF non conforme come prospetto di lavoro non presentabile.
- Aggiunto `tests/audit-remediation.test.mjs` per fissare le correzioni principali.

### 2. Correzioni UI richieste — `6fba1b7`

- **F24:** il banner “Stai usando i dati dimostrativi” ora compare solo in modalità demo e scompare all’uscita.
- **Financial Analysis:** su mobile il menu si chiude dopo la scelta; aggiunto un pulsante di chiusura chiaro; KPI resi più compatti e leggibili con stato testuale, non affidato al solo colore.
- **Fascicolo fiscale cliente:** riallineata la sezione “Importa Excel” su desktop e mobile.
- **Configura con AI:** inseriti screenshot reali e nuove istruzioni per Financial Analysis, LIPE, Fascicolo e F24.

### 3. Audit correttivo delle regressioni — `291d790`

Il primo aggiornamento di “Configura con AI” aveva introdotto errori. Sono stati trovati e corretti:

- vecchia denominazione **Financial Statement** e screenshot obsoleti: il tool è ora indicato come **Bilancio civilistico ITA GAAP**;
- riquadro di configurazione F24 finito in fondo alla pagina: riportato nella griglia corretta dei tool;
- pagine inglese e spagnola rimaste indietro: riallineate alla pagina italiana;
- doppia legenda dei KPI e terminologia incoerente: mantenuta una sola legenda con `Completo`, `Con assunzioni`, `Da integrare`, `Non applicabile`;
- cerchi esplicativi degli screenshot fuori posizione: ancorati all’immagine tramite un contenitore dedicato;
- branding del tool Bilancio allineato nel titolo, header, menu, SEO e footer PDF;
- aggiunto lo screenshot reale `bilancio-ita-gaap-import-20260815.png`;
- test estesi per controllare tutte e tre le lingue, risorse locali, assenza di screenshot obsoleti e unicità della legenda KPI.

## Stato verificato alla consegna

- Branch `main` pulito e allineato a `origin/main` al commit `291d790` prima della creazione di questo handoff.
- “Configura con AI”: **5** schede di configurazione e **6** guide di caricamento in italiano, inglese e spagnolo.
- Verificati desktop `1280px` e mobile `375/390px`, senza scorrimento orizzontale della pagina.
- Verificati: ciclo del banner demo F24, chiusura menu mobile, singola legenda KPI, layout import Fascicolo e caricamento degli screenshot.
- Test eseguito con esito positivo: `node --test tests/audit-remediation.test.mjs`.
- Pubblicazione GitHub Pages completata e verificata sia sul dominio personalizzato sia sull’origine Pages con cache busting.

## Decisioni da non regredire

- Prima di pubblicare su GitHub chiedere sempre autorizzazione esplicita all’utente.
- Coinvolgere l’utente nelle decisioni funzionali o di prodotto rilevanti; gli audit esterni vanno confrontati con codice e decisioni già prese.
- Su mobile le azioni principali devono restare direttamente visibili: evitare un menu generico “Altro”.
- In F24 mantenere **Compila riga per riga** come percorso predefinito e **Compila sul Modello F24** come modello direttamente editabile e validato.
- La modalità demo non deve salvare né sovrascrivere archivi reali in `localStorage`.
- I tool sono pagine statiche molto grandi con funzioni ridefinite in successione: verificare la definizione effettivamente attiva nel browser, non il primo risultato di ricerca nel sorgente.
- Dopo modifiche a `assets/tal-app.css`, incrementare il parametro `?v=` e ripetere i controlli visuali desktop/mobile.
- Dopo ogni pubblicazione verificare l’HTML servito usando `?cb=<timestamp>` per evitare falsi risultati dovuti alla cache.

## File principali interessati

- `tools/financial-analysis/index.html`
- `tools/lipe/index.html`
- `tools/f24/index.html`
- `tools/tfa-client-file/index.html`
- `tools/financial-statement/index.html`
- `configura-ai/index.html`
- `en/ai-setup/index.html`
- `es/configura-ia/index.html`
- `tests/audit-remediation.test.mjs`

Questo file documenta il passaggio di consegne: non introduce modifiche funzionali al sito.
