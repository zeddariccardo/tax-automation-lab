# S06 — preview locale del Forfettario SaaS

Prima preview di prodotto, separata dal Forfettario pubblico. HTML, CSS e moduli JavaScript senza build o nuove dipendenze. Nessun login, collegamento a servizi reali o calcolo fiscale operativo.

## Aprire e provare

Dalla radice del repository frontend:

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

Aprire `http://127.0.0.1:4173/tools/forfettario-saas/`. Arrestare il server con Ctrl+C.

- Entrare come forfettario; in Oggi o Attività, rispondere alla richiesta caricando il documento **di esempio**. Riaprirlo dalla stessa attività.
- Da Attività aprire **Archivio documenti**. **Aggiungi un altro documento** aggiunge un allegato generico: non risponde alla richiesta aperta.
- Usare **Cambia ruolo**, entrare come commercialista e scegliere **Verifica documento** da Da fare. Il documento si apre direttamente: verificarlo e usare **Torna a Da fare**. Il cliente risolto esce dalla coda.
- In Entrate, provare incasso parziale/saldo, aggiunta manuale e importazione d’esempio. Un secondo import non duplica la fattura.
- In Clienti, cercare per nome o ID TAL; aprire e tornare all’elenco: ricerca e posizione si conservano. Da Scadenze, **Dettaglio pagamento** porta al pagamento pertinente.
- Aprire un pannello: il primo Indietro del browser lo chiude senza cambiare pagina. Provare anche Escape, Tab e Shift+Tab.
- Ricaricare la pagina per ripartire: lo stato vive soltanto in memoria nella scheda, senza localStorage/cookie/database. Il cambio ruolo è soltanto una funzione della demo, non autorizzazione.

## Struttura e scelte

| Percorso | Navigazione |
|---|---|
| Ingresso | Forfettario / Commercialista |
| Contribuente | Oggi, Entrate, Tasse, Attività |
| Studio | Da fare, Clienti, Scadenze |
| Cliente aperto dallo Studio | Riepilogo, Entrate, Tasse, Attività; ritorno alla provenienza: Da fare, Clienti o Scadenze |
| Archivio documenti | Destinazione secondaria da Attività e dal documento contestuale |

Oggi mostra incassi, riserva fiscale stimata, prossimo pagamento previsto e l’azione da svolgere. Dopo l’invio resta una conferma compatta: ora tocca allo Studio. Da fare mette prima documenti verificabili e differenze da controllare; le attese hanno peso minore e le eccezioni risolte scompaiono. Attività unisce richieste, risposte e documenti con al massimo una CTA primaria per attività. Eliminati slogan operativi, presentazioni ripetute dello Studio e card celebrative. Stile, fatture, incassi parziali e distinzione attuale/previsione sono preservati.

Skill utilizzata: `ui-ux-pro-max`. Direzione minimalista, palette chiara verde/bianchi caldi, caratteri Inter e Newsreader **già locali**, SVG coerenti. Scartate le proposte automatiche da fintech scuro e font informali perché inadatte al brief. Nessuna risorsa da CDN.

Su mobile la barra principale contiene quattro voci per la posizione personale/cliente e tre per lo Studio. Nel cliente, il ritorno contestuale è sopra la barra inferiore. La richiesta della home arriva prima del pagamento; a 390×844 e 375×812 il pulsante di upload è visibile senza scroll. Metadata documentali verticali, attività senza scroll interno, dialog nel viewport, chiusura di almeno 44×44 px anche con titoli lunghi, focus delimitato/restituito, Escape e Back. Ricerca e scroll dell’elenco sono conservati in memoria; nessuna persistenza reale.

La previsione personale rimane nel percorso contribuente; lo Studio vede i dati condivisi. Questa è una scelta di presentazione coerente con PrivateYearPlan, **non** una dimostrazione di sicurezza/RLS nella demo.

## Confine dei mock

- `demo-service.js`: quattro persone e controparti inventate, ID TAL sintetici stabili, snapshot in centesimi, comandi e selettori di view model. Non importa codice backend.
- `app.js`: viste comuni ai due percorsi, routing hash, interazioni e feedback. Il codice delle viste non contiene endpoint o credenziali. La sostituzione dei mock passerà dal modulo dati e dall’orchestrazione asincrona delle azioni; Auth, autorizzazioni e caricamento reale saranno lavoro separato.
- `app.css`, `mark.svg`: grafica isolata. Solo i font esistenti sono riutilizzati, senza modificarli.
- `index.html`: noindex/nofollow e CSP con `connect-src 'none'`, `form-action 'none'`, soli script/font/stili locali.
- `preview.test.mjs`: nove controlli ripetibili, senza browser o rete, inclusa la distinzione fra allegato generico ed evidenza della richiesta.

Il caricamento aggiunge solo una voce in memoria: non legge, genera, carica o scarica un PDF. L’importazione usa una riga prestabilita, non un parser. Le schermate secondarie degli altri clienti hanno dati ridotti; Mario copre l’intero percorso. Non esistono dossier Redditi PF, F24, AI, invii, login o persistenza.

## Esempio fiscale

Snapshot didattici, non risultati di una chiamata al motore. Mario è un consulente sintetico con coefficiente 78%, imposta 15%, Gestione Separata 26,07%, nessun’altra copertura. Nell’esempio sono già stati versati 4.500 € di acconti previdenziali dell’anno, dedotti dal reddito imponibile e dall’accantonamento residuo. Totali e arrotondamenti in centesimi sono verificati dal test.

Incassi iniziali: 31.240 €; imposta stimata: 2.980,08 €; contributi: 6.352,53 €; **riserva fiscale stimata: 4.832,61 €**. Previsione separata su 42.000 € di incassi: riserva 8.279,53 €. La riserva non rappresenta denaro già accantonato, saldo bancario o un pagamento dovuto a una data. Il **prossimo pagamento previsto** (30 novembre, 2.140 €, imposte e contributi) è un esempio distinto. Le fixture non definiscono una riconciliazione fra questi importi: non si affermano somma, compensazione o inclusione. La stessa spiegazione espandibile è usata in Oggi e Tasse. **Dettaglio riserva** apre sempre la situazione attuale, anche dopo aver consultato la previsione; **Dettaglio pagamento** porta alla scadenza.

Le modifiche agli incassi **non ricalcolano** gli snapshot fiscali: in Oggi compare “Stima iniziale della demo” e il dettaglio Tasse esplicita questo limite. Il futuro motore rimane quello TAL già approvato. Non sostituire gli output autorevoli con questi esempi.

Riscontri utilizzati per la plausibilità degli esempi: [INPS, aliquote Gestione Separata 2026](https://www.inps.it/it/it/inps-comunica/notizie/dettaglio-news-page.news.2026.02.gestione-separata-le-aliquote-contributive-per-il-2026.html), [Agenzia delle Entrate, calendario della precompilata](https://infoprecompilata.agenziaentrate.gov.it/portale/scadenze). Nessuna CU usata come richiesta ordinaria: l’esempio centrale è una ricevuta di versamento contributivo.

## Verifica Step 3 — 27 settembre 2026

```powershell
node --test tools/forfettario-saas/preview.test.mjs
```

| Verifica | Esito |
|---|---|
| Test S06: isolamento, centesimi, stato condiviso, incassi invalidi/parziali, import, messaggi, eccezioni, evidenza esatta e contesto pagamento | 9/9 PASS |
| Ispezione visuale e geometria | Schermate principali a 1440×900, 1024×768, 390×844 e 375×812; nessun overflow osservato; target verificati ≥44×44 px dopo la correzione del pulsante Chiudi |
| Journey contribuente | Fattura da 900 € → incasso → richiesta → upload simulato → documento contestuale → previsione → Oggi; PASS |
| Archivio | Upload generico lascia richiesta aperta; verifica della richiesta riguarda soltanto il documento associato; PASS |
| Journey Studio | Documento aperto da Da fare → verifica → ritorno diretto → cliente cercato → ricerca conservata → pagamento pertinente; PASS |
| Ritorno e accessibilità | Primo Back chiude il pannello; Escape e Tab/Shift+Tab delimitano il focus; ritorno contestuale e ricerca ID TAL; scroll elenco conservato anche con Back (103 px prima/dopo a 375×640); PASS |
| Console e risorse osservate | 0 errori/warning e nessun 404 segnalato nel browser; 7 risorse osservate tutte localhost; CSP e codice escludono chiamate a servizi/API |
| Suite statica frontend | 310/310 PASS |
| Suite generale backend, senza modifiche | Non verde in questo ambiente: 573 PASS, 260 SKIP, 73 FAIL; riscontrato blocco `browserType.launch: spawn EPERM` nelle prove con Chromium esterno |

La verifica S06 è stata svolta nel browser disponibile con click, scroll, digitazione, modali e navigazione. La suite browser/E2E generale preesistente non è certificata nuovamente da questo step. I risultati del precedente Step 1 non sono presentati come nuove esecuzioni. La sonda HTTP indipendente dalla shell ha restituito ECONNREFUSED; la preview e le sue risorse sono state verificate dal browser, dove il caricamento funziona. Nessuna installazione o modifica globale per aggirare questi limiti.

Restano da valutare con utenti reali la comprensione degli importi e il lavoro su portafogli numerosi. Le prove mobile usano viewport desktop: non verificano hardware iOS/Android, tastiera virtuale o selettore file nativo. L’upload resta deliberatamente simulato. Nessun collegamento a servizi reali in questo step.

Nessun commit, push o deployment. Nessuna modifica alle cartelle del Forfettario pubblico, al backend, al Worker, alla homepage, al catalogo o alla sitemap. I cambiamenti utente preesistenti sono preservati.

## Verifica checkpoint S06 — 27 settembre 2026

Rieseguiti: suite S06 **9/9 PASS**, controlli statici frontend **310/310 PASS**, journey contribuente e Studio nel browser. Le 38 rilevazioni alle larghezze 1440, 1024, 390 e 375 px non mostrano overflow orizzontale o bersagli visibili inferiori a 44 px. Console senza errori/warning, nessun 404 osservato e sole sette risorse locali; nessun servizio reale collegato. Le fixture della demo sono state ripristinate dopo le simulazioni.

La suite backend non è stata rieseguita in questo checkpoint, come richiesto: l'ultima esecuzione riportata sopra aveva failure di avvio Chromium `EPERM`, non attribuite alle modifiche S06. Hash e diff confermano che il Forfettario pubblico e le superfici pubbliche preesistenti sono invariati.

Checkpoint autorizzato sul branch separato `checkpoint/s06-ux-preview`. GitHub Pages pubblica da `main`: questo checkpoint lascia `main` e le impostazioni Pages invariati e non prevede deployment. Il commit comprende esclusivamente questa cartella; le modifiche preesistenti dell'utente restano escluse.

## S06.1 — Rilevazione brand prima delle modifiche

Fonti lette: `assets/site-shell.css`, `assets/tal-app.css`, `assets/tal-design.css`, font locali e header della homepage. Confronto renderizzato: homepage, Forfettario pubblico, F24 e Analisi di bilancio, senza operare sui loro dati.

| Token TAL rilevato | Valore esistente | Uso nella preview |
|---|---|---|
| `--tal-accent / -2 / -deep / -soft` | `#145368 / #1D6A7F / #0C3341 / #EAF2F5` | CTA e hover, link, navigazione attiva, accenti e superfici discrete |
| `--tal-session-1 / --tal-save-1` | `#5B3A8C / #6D3C99` | Viola già presente nelle barre/azioni TAL: focus e selezioni secondarie, senza gradienti |
| `--tal-violet` editoriale | `#A867D8` | Riferimento della famiglia viola; per i controlli su carta si usa la variante scura già esistente |
| `--tal-paper / -card / -sunken` | `#F6F5F1 / #FFFFFF / #F0EFEB` | Canvas, superfici di lavoro e dettagli neutri |
| `--tal-fg / -ink / -ink-2 / -ink-3` | `#0B0B0B / #1D1B16 / #47443F / #6E6B65` | Testo, importi operativi, secondari e bordi dei campi |
| `--tal-line / -line-2` | `#E7E4DC / #DCDAD4` | Separatori e bordi |
| `--tal-warn / --tal-gold` | `#A53D28 / #8B6A16` | Messaggi espliciti già presenti; nessuna nuova semantica fiscale |

Nel CSS condiviso, le variabili storiche `--tal-purple` sono alias petrolio: il viola effettivo dei tool viene dai token session/save definiti più avanti. Il focus attuale dei tool è petrolio; S06.1 usa il viola scuro TAL per il focus, come richiesto. Il sito editoriale usa testi chiari su fondo scuro: questi valori non vengono trasferiti sui fondi chiari dell'app.

Identità: riutilizzare il monogramma RZ effettivamente incorporato nell'header TAL, mantenendone pixel e proporzioni, al posto della T inventata in S06. Tipografia: Inter per lavoro quotidiano, numeri e pannelli; Newsreader solo nel titolo d'ingresso, in continuità con la homepage. Nessuna modifica a IA, dati, copy operativo o journey.

### Esito S06.1

Allineati soltanto `app.css`, `mark.svg`, il theme-color di `index.html` e questo README. CTA/link/navigazione usano petrolio; nome TAL, focus e selezioni secondarie usano viola scuro. Le due opzioni attuale/previsione hanno lo stesso trattamento quando selezionate: viola indica selezione, non previsione o un significato fiscale. Importi dovuti e stati documentali restano leggibili attraverso testo, icone e gerarchia. Nessun gradiente aggiunto, nessun aumento di padding o altezza delle superfici.

Il PNG del monogramma è copiato byte per byte dall'header homepage e incorporato in `mark.svg` su una piccola base petrolio, senza ridisegnarlo o alterarne le proporzioni. SHA-256 del PNG originale/riusato: `63d8ff503e0ee79daf8c0134b02572fcece4f386e7b9a9623f4b17050c1e0413`. Nessuna nuova risorsa esterna.

Verifica nel browser: confronto TAL/F24 e SaaS alla stessa larghezza, entrambe le aree a 1440×900, 1024×768, 390×844 e 375×812; nessun overflow o target visibile inferiore a 44 px nelle 44 rilevazioni. Journey contribuente (fattura, incasso, richiesta, documento, previsione, Oggi) e Studio (verifica, ritorno alla coda, ricerca ID conservata e scadenza pertinente): PASS. Verificati focus viola, Tab, delimitazione del focus nella modale e Back; i mock sono stati ripristinati.

Test S06 **9/9 PASS**, statici frontend **310/310 PASS**. Nessun errore/warning console o 404 osservato; sette risorse locali e CSP `connect-src 'none'`. Contrasto minimo dei testi visibili campionati nelle schermate mobili: **4,68:1**, senza failure; non costituisce certificazione completa di accessibilità. Il confronto visivo conferma la stessa identità TAL con layout S06 autonomo.

`app.js`, `demo-service.js` e i test funzionali sono invariati; nessuna modifica fuori dalla preview rispetto allo snapshot iniziale. Lavoro locale su `checkpoint/s06-ux-preview`, senza commit, push, deployment o collegamenti a servizi reali.
