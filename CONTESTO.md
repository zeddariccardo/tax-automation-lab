# Contesto per la prossima sessione

Stato al 13 agosto 2026. Questo file serve a ripartire senza rileggere tutto.

## Cos'è questo repository

Sito statico pubblicato su GitHub Pages (`zeddariccardo/tax-automation-lab` →
taxautomationlab.com). Nessun build, nessuna dipendenza da installare: si apre
un file e si modifica. Per provarlo in locale:

```bash
python -m http.server 4173 --directory <cartella del repo>
```

**63 pagine HTML**: 58 editoriali (italiano, inglese, spagnolo) e 5 applicazioni.

## I due layer di stile

Tutto lo stile passa da due file condivisi, agganciati in fondo al `<head>`.
Sono mutuamente esclusivi e non possono contaminarsi:

| File | Si applica a | Aggancio |
|---|---|---|
| `assets/tal-design.css` | 58 pagine editoriali | `html:not(.tal-tool-page)` |
| `assets/tal-experience.js` | idem | sfondo animato, comparsa allo scroll |
| `assets/tal-app.css` | 5 applicazioni | `html.tal-tool-page` |
| `assets/tal-app.js` | idem | barra comandi condivisa |

Gli indirizzi portano `?v=20260812` (`?v=20260814` su `tal-app.css` e
`tal-app.js` nei cinque tool): **va incrementato a ogni modifica dei
fogli**, altrimenti i browser di chi ha già visitato il sito servono la versione
vecchia.

`tal-app.js` non è più solo la barra comandi: dalla 2.0 tiene anche la barra di
sessione unica, lo spostamento di «Informazioni sullo strumento» dentro «Come si
usa», la tinta dei pulsanti per etichetta e l'apertura di «Configura con AI» in
scheda nuova. Vedi la sezione del 14 agosto in fondo.

Documentazione di dettaglio: `assets/tal-design.README.md`.

## Le regole di stile che valgono ovunque

- **Font**: Inter e Newsreader, self-hosted in `assets/fonts/`. Nessuna chiamata
  esterna: il sito dichiara che non raccoglie dati e deve restare vero.
- **Sfondo editoriale**: petrolio ≈76%, viola ≈23%, ruggine come accento. Il
  viola era al 47% e schiacciava tutto: non riportarlo su.
- **Accento unico dei tool**: petrolio `#145368`. Niente lime, niente blu, niente
  viola: erano tre accenti diversi in quattro tool.
- **Verde = aggiungi, arancio = modifica, viola→petrolio = salva**
  (`.btn.add`, `.btn.edit`, `.btn.save`). Dalla 2.0 le classi le mette
  `tal-app.js` leggendo l'etichetta; per forzare o escludere un pulsante,
  `data-tal-tone="add|edit|save|none"`.
- **Sidebar dei tool**: petrolio, stato attivo in pastiglia bianca.
- Tutto il movimento rispetta `prefers-reduced-motion`.

## I cinque tool

`/tools/financial-statement/` · `/tools/financial-analysis/` · `/tools/lipe/` ·
`/tools/tfa-client-file/` · `/tools/f24/`

Sono **solo in italiano**. Le pagine `/en/tools/<slug>/` e `/es/tools/<slug>/`
sono pagine di avviso in `noindex` che spiegano perché e rimandano alla versione
italiana. Scelta deliberata: mantenere tre copie tradotte di applicazioni che
cambiano ogni settimana significa correggere una lingua e lasciare indietro le
altre due.

Struttura comune della sidebar, uguale nei primi quattro (per il quinto vedi
più sotto: il Generatore F24 tiene di proposito un percorso numerato):

```
CONFIGURAZIONE     Clienti · Importa da Excel · Configura con AI
<lavoro>           le voci proprie del tool
RISULTATI E DATI   Esporta · Dati e backup · Come si usa
```

Tutti **aprono su Clienti**, e in cima a quella schermata trovano le stesse tre
strade: Importa da Excel, Inizia a mano, Prova con i dati dimostrativi.

**Stato reale della struttura (12 agosto 2026).**

| Tool | Gruppo «Risultati e dati» | Deep link |
|---|---|---|
| `financial-statement` | completo: Esporta · Dati e backup · Come si usa | sì |
| `financial-analysis` | completo dalla 2.1.0 | sì |
| `tfa-client-file` | completo (è il riferimento originario) | sì (`#/profilo/tax`) |
| `lipe` | ha solo «Esporta e storico»: mancano Dati e backup e Come si usa | no |
| `f24` | completo, ma sotto al percorso a quattro passi | sì (`#/verifica`) |

**Attenzione a come si legge la sidebar di `financial-analysis`.** Un `grep` sul
sorgente restituisce i gruppi «Flusso di lavoro» e «Gestione»: appartengono alle
definizioni morte di `renderSidebar` (trappola 1) e **non** sono quello che
l'utente vede. La sidebar reale ha cinque gruppi. Va guardata renderizzata nel
browser, non nel sorgente — è lo stesso errore in cui sono già caduto una volta.

**Indirizzi di sezione.** Bilancio e Analisi hanno i deep link con `pushState` e
`popstate`: il tasto Indietro cammina fra le sezioni invece di uscire dal tool.
Resta da fare in LIPE.

**Banda nera.** `footer.foot` (fondo `#0b0b0b`) è stata rimossa da tutti e tre i
tool che la avevano; il Fascicolo non la ha mai avuta. Il disclaimer specifico
del tool non è andato perso: è stato unito al paragrafo di `.tal-site-footer`.
La CSS di `.foot` è rimasta lì di proposito — la stringa «foot» compare anche in
jsPDF minificato (`n.foot.length`, `showFoot`) e una sostituzione larga
romperebbe il motore PDF.

**Il Generatore F24 non ha la sidebar comune, ed è una scelta.** È l'unico tool
con un percorso numerato a quattro passi (Contribuente · Pagamenti · Verifica ·
Scarica), perché quello che l'utente prepara non è un documento ma un
versamento con una scadenza, e l'ordine dei passi è vincolante. Sotto al
percorso ci sono comunque le voci comuni — Archivio contribuenti, Archivio
crediti, Configura con AI, Dati e backup, Come si usa — e tutto il resto
(colori, controlli, tabelle, finestre, barra comandi) viene da `tal-app.css`.
Se in futuro si uniformasse, il lavoro è sostituire la sola `.workspace-nav`.

Versioni reali (allineate ovunque, anche nei dati strutturati):
`1.4.1` Bilancio ITA GAAP · `2.1.0` Analisi di bilancio · `2.3.2` Fascicolo
cliente · `3.6.0` LIPE · `1.0.0` Generatore F24.

## Trappole verificate sul campo

Queste sono costate errori veri. Vale la pena leggerle prima di toccare i tool.

1. **`financial-analysis` ha sette definizioni successive di `renderSidebar`**,
   in sette blocchi di script. Vale l'ultima (quella con `NAV_GROUPS` per
   chiave). Modificare le precedenti non ha alcun effetto: è codice morto.
2. **`VIEW_DEFS` viene modificato a runtime** da quattro patch che usano indici
   fissi (`splice(2,0,…)`). Non riordinare quell'array: la sidebar si costruisce
   **per chiave**, non per posizione, proprio per questo.
3. **Mai fare sostituzioni da riga di comando** su questi file: la shell
   interpreta `$(...)` e taglia il codice. Scrivere sempre uno script Python su
   file. Un taglio del genere ha già spento un intero blocco di script.
4. **`requestAnimationFrame` non è affidabile** per logica necessaria: in scheda
   non attiva non parte. Usare `setTimeout`.
5. **Verificare sempre la pagina renderizzata, non il sorgente.** Diversi errori
   sono emersi solo cliccando davvero i pulsanti.
6. **Attenzione alle virgolette negli `onclick`**: virgolette doppie interne
   chiudono l'attributo a metà e il pulsante smette di funzionare in silenzio.
7. **Il browser tiene in cache i fogli di stile**: senza cambiare `?v=` si
   misurano valori vecchi credendo che una modifica non abbia funzionato.
8. **`STATE` e `RESULT` sono dichiarati con `let`** nello script principale del
   Bilancio: **non** sono proprietà di `window`. Un blocco di patch che scrive
   `window.RESULT` o legge `window.STATE` fallisce in silenzio — e sembra che i
   dati non ci siano. Riferirli senza qualificatore.
9. **I codici dei nodi si ripetono fra le sezioni**: `B` è Immobilizzazioni
   nell'attivo e Fondi per rischi e oneri nel passivo, `C` e `D` altrettanto. Una
   mappa unica per codice di nodo mescola le due sezioni. Nell'export XBRL le
   chiavi ambigue sono qualificate (`att:B`, `pas:B`).
11. **Anche `financial-statement` ha definizioni sovrapposte**, non solo
   `financial-analysis`. `computeFrom`, `refreshAll`, `renderStorni`,
   `renderAdjustments`, `renderChecks`, `loadMemory` e `downloadTemplate`
   esistono in due o tre versioni: **vale l'ultima**. Modificare la prima non
   produce alcun effetto e sembra che il tool ignori la correzione — mi è
   successo il 13 agosto su tre funzioni di fila. Prima di toccare qualcosa,
   chiedere al browser `String(nomeFunzione)` e cercare *quel* testo nel file.
   `computeFrom` in più è avvolta da `realignResult`, quindi il suo `String()`
   mostra il wrapper: la definizione vera è la terza, alla riga 3294 per il
   loop degli storni.
10. **Il vecchio `fsShowView` è chiuso dentro il suo IIFE** e la sidebar è
   agganciata a quello. Sostituire `window.fsShowView` non basta: serve un
   listener in fase di cattura su `#sidebar` che fermi la propagazione.

## Cosa non va toccato

- **L'easter egg di Romeo** (`assets/romeo-game.*`, classi `rg-*`): raggiungibile
  dalla parola «papà» in *Chi sono*. È escluso esplicitamente dalle regole
  tipografiche globali; se lo si include, la lettera diventa illeggibile.
- **La barra comandi del Fascicolo** è scura di proposito, con testo chiaro.
  Schiarirla rende il sottotitolo bianco su bianco (già successo).
- **`.workspace-nav`** è una barra chiara in un tool e la lista dentro alla
  sidebar scura in un altro: schiarirla ovunque produce bianco su bianco.

## Come verifico prima di pubblicare

- **Audit statico** (Python): tutti i link interni e i riferimenti ad asset
  risolvono, meta e `lang` presenti, layer corretto per tipo di pagina.
  Ultimo esito: 842 link, 409 asset, **0 problemi**.
- **Audit di contrasto** nel browser: ogni elemento con testo confrontato con il
  fondo reale, soglia WCAG. Ultimo esito: nessun fallimento su 4 tool e 29
  pagine editoriali.
- **Nessuno scorrimento orizzontale** a 375, 768, 1280, 1385px.

## Bilancio civilistico — cosa è cambiato con la 1.4.0

Audit del 12 agosto 2026, tutto verificato sulla pagina in esecuzione.

**Correttezza.** Il risultato d'esercizio era congelato nella riga tecnica
`TAL_AIX` creata all'import: ogni rettifica IAS→OIC con effetto sul risultato
sbilanciava lo stato patrimoniale di quell'importo e l'export si bloccava. Le
rettifiche erano quindi inutilizzabili nel caso normale (leasing IFRS 16, TFR
IAS 19, accantonamenti). Ora la riga tecnica si riallinea a ogni ricalcolo; i
conti A.IX importati dall'ERP non si toccano e lo scarto lo segnala la verifica.

Altri tre difetti chiusi: l'anagrafica non si azzerava importando il file di
un'altra società (e la P.IVA è la chiave d'archivio: si poteva salvare il
bilancio di B sotto A); «Nuova elaborazione» non cancellava `fs_draft_v1`, così
al reload i dati tornavano; il template Excel usciva con righe d'esempio che non
riconciliavano (Δ 122.000), quindi chi lo scaricava e lo ricaricava per provarlo
vedeva il tool «rotto». Ora l'esempio del template **è** il dataset dimostrativo,
sorgente unica in `FS_DEMO_ACCOUNTS`.

**Output.** Nuovo prospetto in formato di deposito: le voci di gruppo sono
intestazioni senza importo e il blocco chiude con il totale ufficiale (`Totale
immobilizzazioni (B)`, `Totale attivo circolante (C)`, `Totale patrimonio netto`,
`Totale valore della produzione`, `Totale proventi e oneri finanziari
(15 + 16 - 17 + - 17-bis)`, fino a `21) Utile (perdita) dell'esercizio`). Prima
il gruppo portava il proprio importo *prima* dei figli: l'inverso del depositato.
Colonne intestate con le due date, blocco «Dati anagrafici», voci nulle in
entrambi gli esercizi omesse. Visibile nella scheda **Prospetto di deposito**:
è la stessa funzione che genera PDF, Excel e XBRL, quindi i quattro documenti
non possono divergere.

Sette campi nuovi in Anagrafica, richiesti dall'intestazione del depositato:
capitale interamente versato, ATECO, società in liquidazione, socio unico,
direzione e coordinamento (+ denominazione), appartenenza a un gruppo.

**XBRL.** `exportXBRL()` genera l'istanza con i nomi elemento della tassonomia
ufficiale **PCI 2018-11-04** (namespace
`http://www.infocamere.it/itnn/fr/itcc/ci/2018-11-04`, prefisso `itcc-ci`),
estratti dal file della tassonomia, non dedotti.

La struttura è stata poi allineata a **un'istanza realmente depositata** al
Registro delle imprese (abbreviato, esercizio 2025). Quel confronto ha corretto
quattro cose che dalla sola tassonomia non si ricavano, e che il primo tentativo
aveva sbagliate:

| | Ipotesi iniziale | Come è davvero |
|---|---|---|
| `schemaRef` | URL assoluto (che risponde 404) | riferimento **relativo** `itcc-ci-abb-2018-11-04.xsd`, con `xlink:arcrole` |
| identificativo | scheme `.../partitaIVA`, valore con prefisso `IT` | scheme `http://www.infocamere.it`, valore = **codice fiscale numerico** |
| contesti | solo entity + period | serve anche `<scenario><scen>itcc-ci:depositato</scen></scenario>` |
| importi | `decimals="2"`, centesimi | `decimals="0"`, **unità di euro** |

L'elemento `scen` **non esiste nella tassonomia PCI**: lo aggiunge il software di
deposito ed è il marcatore del bilancio depositato. Senza quel blocco l'istanza
non è quella che il Registro si aspetta.

Il confronto ha fatto emergere anche una lacuna sostanziale. Il linkbase di
calcolo dell'abbreviato **non somma le voci di dettaglio dentro il totale**: passa
da due elementi aggregati intermedi (c+d+e del personale, a+b+c degli
ammortamenti). Senza di loro «Totale costi per il personale» e «Totale
ammortamenti e svalutazioni» risultano incoerenti in validazione. Ora vengono
calcolati e scritti, con il flag `dur` perché sono voci di durata — la prima
versione li metteva nei contesti istantanei, che è di per sé un errore.

Verifica automatica: **28 regole** estratte da `itcc-ci-cal-spabb` e
`itcc-ci-cal-ceabb`, tutte coerenti. Copertura: solo `D_CE` (la voce legacy
«rettifiche nette non analitiche») non ha un elemento corrispondente, ed è
segnalata invece di essere scartata in silenzio.

Cosa **resta aperto**:

- **La nota integrativa non c'è.** Un deposito completo contiene i blocchi
  `Introduzione*` e `Commento*` più `DichiarazioneConformita`: l'istanza del tool
  ha dati anagrafici, stato patrimoniale e conto economico. Va completata.
- **Schema ordinario**: il prefisso dello scenario (`itcc-ci-ese`) è dedotto per
  simmetria dall'abbreviato, non confrontato con un'istanza ordinaria reale.
  `CFG.ordinaryScenarioVerified` è `false` e il pannello lo dichiara.
- Nell'ordinario alcune voci sono riportate sul totale della voce perché la
  tassonomia le articola per scadenza (entro/oltre) e il tool non gestisce quella
  ripartizione. Il pannello le elenca una per una.
- L'arrotondamento all'unità di euro può spostare una quadratura di qualche euro:
  il generatore lo controlla e lo dichiara invece di lasciarlo passare.

Tutto ciò che è configurabile sta in `window.FS_XBRL_CONFIG`.

## Bilancio civilistico — audit esterno e nove correzioni, 13 agosto 2026

Un audit fatto fare a ChatGPT ha alzato dodici rilievi. Verificati uno per uno
sul sorgente e sulla pagina in esecuzione: **cinque veri, uno falso, gli altri
fuori perimetro o già noti**. Vale registrare anche il falso, perché la sua
smentita costa mezz'ora ogni volta che qualcuno rilegge il file.

**I difetti veri, chiusi.**

1. **Riserva legale mappata su `AVI` invece che su `AIV`.** Tre dataset gemelli
   (righe di esempio del template, demo legacy, `FS_DEMO_ACCOUNTS`) portavano lo
   stesso errore. La tassonomia interna distingueva già le due voci: era un
   errore nei dati, e si propagava fino all'XBRL.
2. **L'anno dell'archivio veniva dall'anno solare.** `defaultYear()` legge la
   data di chiusura, ma demo e import riempiono l'Anagrafica **per
   assegnazione diretta**: `input` e `change` non partono, il listener che
   risincronizza non scattava e la scheda restava sull'anno calcolato al boot.
   Un esercizio 2025 finiva sotto il 2026, e il tool proponeva poi il 2027 come
   successivo. Ora `showResultsUI` richiama `fsResetSaveYear`, e `saveToYear`
   pretende la data di chiusura e chiede conferma se l'anno diverge (serve per
   gli esercizi a cavallo).
3. **URL e voce attiva restavano indietro** dopo demo e import. Causa esatta:
   il wrapper di `showResultsUI` nel blocco `fs-nav-v110` chiamava la
   `fsShowView` **locale** — quella vecchia a quattro viste, che non spinge
   l'indirizzo — invece di `window.fsShowView`, che al momento della chiamata è
   la versione a sette viste. Una parola.
4. **Gate di export incompleto.** Si fermava su A.IX, quadratura corrente e data
   di chiusura; **mappature non valide** e **rettifiche non quadrate** restavano
   FAIL rossi che non impedivano nulla e arrivavano fino all'istanza XBRL. Ora
   c'è un gate unico, `window.fsExportGate`, da cui passano working paper,
   prospetto di deposito e XBRL. Quadratura precedente e coerenza CE restano
   avvisi: il comparativo può mancare per scelta.
5. **Valute diverse dall'euro accettate** in Anagrafica mentre l'istanza XBRL
   scrive sempre unità EUR. Il selettore ora offre solo EUR, e l'export XBRL si
   ferma comunque se trova altro (fascicoli salvati prima).

**Il falso positivo, da non riaprire.** L'audit sostiene che «Crea nuovo anno»
riporta storni e rettifiche nell'esercizio successivo. **Non era vero**: la
`loadMemory` viva (l'ultima delle tre definizioni) applica solo la mappatura.
Il rilievo nasce dal leggere la `loadMemory` **morta** più in alto nel file, che
invece li ripristinava. Verificato in pagina: creato il nuovo anno con riporto
attivo e reimportato il file, storni e rettifiche non tornavano.

Quello che c'era davvero era una **etichetta bugiarda** — la casella diceva
«Riporta configurazione (anagrafica, mapping, storni, rettifiche)» — e una
scrittura morta: `newYear` infilava storni e rettifiche nella memoria per
P.IVA, dove nessuno li leggeva. Scelta presa: **farlo funzionare davvero**,
perché le stesse scritture IAS→OIC (leasing, TFR) tornano ogni anno.

Come funziona ora: `newYear` mette storni e rettifiche in `carryPending` dentro
la memoria per P.IVA; `loadMemory` li rimette in campo al primo import
**spenti** (`active:false`, `carried:true`, `carriedFrom`), li segnala con un
avviso in cima alle schede Storni e Rettifiche e con la pastiglia «da
riconfermare» su ogni riga; riattivarli è un clic e cancella il marchio.
`carryPending` si consuma una volta sola. Nessun importo dell'esercizio
precedente entra nei prospetti senza che qualcuno lo abbia riconfermato.
Gli storni ora rispettano `active===false` come già facevano le rettifiche —
il controllo va messo nel loop di `computeFrom` **alla riga 3294**, non in
quello all'inizio del file, che è morto.

**Altre quattro cose chiuse nello stesso giro.**

- **Foglio «Esiti AI» finalmente importato.** I due template Excel erano
  diversi: sei fogli quello di «Configura con AI», cinque quello scaricato dal
  tool, e l'import ignorava il sesto. Fonti, assunzioni e dubbi restavano fuori
  dalla sessione di lavoro. Ora `readAiFindings` lo legge (saltando la riga di
  esempio e leggendo come chiuse le righe già marcate «risolto»), le eccezioni
  compaiono nella scheda Verifiche come elenco da spuntare, il contatore sta
  nella barra dell'import, e il template del tool ha lo stesso sesto foglio.
  **Attenzione:** le intestazioni sono composte («Codice conto / campo»,
  «Osservazione / assunzione») e `V13.findHeader` vuole la corrispondenza
  esatta: qui serve il prefisso, per questo la ricerca è locale.
- **Prospetto di deposito in unità di euro.** OIC 12 e il depositato non hanno
  decimali; il working paper li tiene. Anteprima, PDF ed Excel di deposito ora
  arrotondano, e lo scarto fra totale e somma delle righe arrotondate viene
  **misurato e dichiarato** nell'anteprima, come già fa il generatore XBRL.
- **Una sola costante di versione.** `window.FS_VERSION='1.4.0'`, letta dagli
  altri due `VERSION` e dalla riscrittura dell'etichetta, che prima cercava
  `1.1.3` e scriveva `1.3.6`. I commenti di blocco tengono la versione in cui
  il blocco è nato: è storia, non stato corrente.
- **Menu del sito su telefono**, il difetto già annotato in «Aperto»:
  aggiunto `.tal-gh-menu-toggle` con il suo handler. Resta da fare in
  `financial-analysis`.

**Dove non ho seguito l'audit, e perché.** Separare bundle e librerie e
caricare i moduli su richiesta contraddice l'architettura voluta (file unico,
elaborazione locale, apribile da disco). PDF/A, font incorporati e tag di
accessibilità costano molto su un documento che comunque non è il file
depositato. Micro-impresa: gli schemi sono quelli dell'abbreviato, non serve
una terza voce. XBRL ordinario: il pannello dichiara già `ordinaryScenarioVerified
= false`.

## Analisi di bilancio — cosa è cambiato con la 2.1.0

Audit del 12 agosto 2026, eseguito sulla pagina viva.

**Quello che già funzionava** (vale registrarlo, per non rifare il lavoro): tutte
e 20 le viste rendono senza errori JavaScript; gli 11 export producono file veri;
l'import funziona e il gate di validazione è severo e corretto — ha colto con
precisione due errori nei dati di prova che avevo costruito male, prima
sull'esercizio corrente e poi sul precedente. La ricostruzione della voce tecnica
A.IX viene proposta su entrambi gli esercizi.

**Il bug del Bilancio qui non esiste.** Le rettifiche di `financial-analysis`
sono normalizzazioni a una sola gamba (`currentEffect`, `previousEffect`,
`category`) per l'EBITDA normalizzato, non scritture in partita doppia: non
toccano lo stato patrimoniale e non possono sbilanciarlo. Progetto diverso e
appropriato al tool.

**Allineamento.** Le funzioni del concept condiviso c'erano tutte: erano nominate
e collocate diversamente. «Report Center» era di fatto la sezione Esporta, e i
due backup erano separati (quello della società nel Report Center, l'archivio
clienti dentro Clienti). Quindi:

- «Report Center» → **«Esporta»**;
- nuova vista **«Dati e backup»** che raccoglie archivio clienti e
  configurazione della singola società, più «Nuova elaborazione»;
- Configurazione riordinata: **Clienti · Anagrafica · Importa da Excel ·
  Mappatura conti · Configura con AI**;
- **deep link** per tutte le 21 sezioni.

I due gruppi in più — «Analisi integrative» e «Analisi avanzate» — sono rimasti:
sono voci di lavoro proprie del tool, che è più grande degli altri, e il concept
prevede esplicitamente `<lavoro>` come sezione libera.

**Correzioni sostanziali.** Il template usciva con i fogli Stato Patrimoniale e
Conto Economico **vuoti**: scaricarlo e ricaricarlo per capire come funziona
restituiva «Il file non contiene uno Stato Patrimoniale utilizzabile», che si
legge come un difetto del file e non come «non l'hai ancora compilato». Ora
contiene un esempio completo e quadrato (SP +70.000 / CE −70.000), come il
Bilancio. E la diagnostica di un import rifiutato non sopravvive più al tentativo
successivo: si vedevano messaggi di run diverse mescolati, anche in
contraddizione fra loro.

**Non toccati** `VIEW_DEFS` e `renderSidebar`: la sidebar si ritocca sul DOM dopo
il rendering, come già fa la patch v2.0.3. Vedi le trappole 1, 2 e 10.

**Resta aperto, ed è una divergenza vera di concept:** i sei report PDF di
`financial-analysis` aprono una finestra con `window.open` e la stampa del
browser, mentre il Bilancio genera il PDF con jsPDF e lo scarica. Sono due
esperienze diverse per la stessa azione, e la finestra può essere bloccata dal
popup blocker. Uniformarle vuol dire riscrivere sei generatori: è un lavoro a sé,
non una correzione di audit.

## LIPE — cosa è cambiato con la 3.5.0

Audit del 12 agosto 2026, con a disposizione **una fornitura IVP18 realmente
trasmessa e accettata** come riferimento. È stato quel confronto a far emergere
tutto quello che segue: la sola specifica non bastava.

**Quello che già funzionava:** cinque sezioni senza errori JavaScript, sei export
che producono file (PDF compreso, con jsPDF), entrambi i template con righe di
esempio, import di codiciario e importi. Sull'XML i nomi e l'ordine degli
elementi, la virgola come separatore decimale, lo scambio
`IvaDovuta`/`ImportoDaVersare` ↔ `IvaCredito`/`ImportoACredito`, il riporto di
`CreditoPeriodoPrecedente` e il formato `DataImpegno` (ggmmaaaa) erano **già
esatti**. La validazione su codici fiscali, partite IVA, codice carica e gruppo
IVA è accurata.

**Il difetto grave.** `buildXml()` legge `state.activeRecord.client`, cioè il
cliente **salvato**, mentre l'utente guarda il modulo. Con i dati
dell'intermediario digitati e non salvati il frontespizio usciva **senza**
`CFIntermediario`, `ImpegnoPresentazione`, `DataImpegno` e `FirmaIntermediario`,
e `problems` restava **vuoto**: la comunicazione risultava presentata dal
contribuente invece che dall'intermediario, senza un solo avviso. Su un file che
va all'Agenzia non è accettabile che accada in silenzio. Ora la generazione si
blocca ed elenca i campi divergenti.

**Gli altri tre.**

| | Prima | Dopo (come nella fornitura reale) |
|---|---|---|
| `IdentificativoProdSoftware` | qualunque valore, nessuna validazione; il demo suggeriva `RZTAXLAB` | vuoto per scelta, validato se compilato |
| `identificativo` della comunicazione | `String((Date.now()%99999)+1)`: cambiava a ogni generazione | `00001`, il progressivo dentro la fornitura |
| intestazione | `encoding="utf-8"`, niente `standalone`, quattro namespace di cui due mai usati (`cm`, `sc`) | `encoding="UTF-8" standalone="yes"`, solo `iv` e `ds` |

**Sull'identificativo del produttore software** vale la pena essere precisi,
perché è facile fraintenderlo. Nel tracciato identifica **chi ha prodotto il
software** che genera il file, non chi presenta la comunicazione: nella fornitura
di riferimento è `01035310414`, il codice di una software house. Tax Automation
Lab **non ne inserisce uno** — non avrebbe senso pubblicare un codice fiscale
personale in un sito statico, e il progetto non è una software house. Quindi:
campo vuoto per default, elemento non scritto nel file, nessun blocco. Se il
canale di trasmissione lo richiede, l'utente lo compila con il codice fiscale del
soggetto che assume quel ruolo; se il valore non è un codice fiscale valido la
generazione si blocca. La spiegazione sta accanto al campo e in «Come si usa»,
con il rimando al software di controllo dell'Agenzia come verifica definitiva.

Il progressivo del **nome file** resta invece incrementale per cliente, anno e
periodo (`_LI_00001`, `_LI_00002`, …) e avanza **solo** quando il file viene
davvero scaricato: due invii successivi dello stesso periodo restano
distinguibili, ma rigenerare la stessa comunicazione dà sempre lo stesso file.

**Verifica strutturale:** frontespizio con gli **stessi 11 elementi nello stesso
ordine** della fornitura reale, intestazione identica, moduli con la stessa
sequenza. 16 controlli sul flusso completo, tutti passati.

**Allineamento al concept:** «Esporta e storico» → **«Esporta»**, nuove sezioni
**«Dati e backup»** e **«Come si usa»**, deep link su tutte e sette le sezioni.
LIPE era l'ultimo tool non allineato.

## Generatore F24 — nuovo, 1.0.0

Integrato il 13 agosto 2026 partendo dallo standalone `F24_Massivo_v0.9.0`.
Non è un travaso: il codice applicativo è stato riscritto in un blocco solo.

**Perché la riscrittura non era rimandabile.** La 0.9.0 **si rompeva
all'avvio**: `renderOutputSummary` scriveva su `#telematicNotice`, un elemento
che nel markup non è mai esistito. L'eccezione partiva da `setMode('single')` e
fermava la riga di boot, quindi `renderAll()`, `goStage()` e
`restoreAutosavePrompt()` non venivano mai eseguiti. Il blocco telematico più
avanti ridefiniva `renderOutputSummary` e nascondeva il sintomo *dopo* il boot:
il difetto era invisibile guardando la pagina, ma **il ripristino del
salvataggio automatico era morto** — verificato piantando un progetto in
`localStorage`, la finestra «Riprendere il lavoro?» non compariva mai.

Gli altri tre difetti chiusi: `addRow`, `duplicateRow`, `deleteRow` e
`toggleSelectAll` non chiamavano `touchState()`, quindi la memoizzazione non si
invalidava e **cancellare una riga non toglieva l'F24 corrispondente** né
dall'elenco né dai totali né dallo ZIP; `importClientsFile` chiamava
`excelDate()`, funzione inesistente, quindi ogni import di anagrafiche da Excel
terminava con un'eccezione; nella sezione INAIL il saldo era scritto a Y 229,4
mentre gli importi della stessa riga stanno a 228,0.

**Un difetto emerso solo sotto carico**, con 50 società da 40 righe: la
capienza delle sezioni veniva calcolata in `groupF24()` ma non arrivava a
`validateProject()`. Il pulsante dichiarava «pronto» e l'esportazione poi si
rifiutava. Ora i rilievi del modello nel suo insieme stanno in `g.ownIssues` e
sono errori bloccanti a tutti gli effetti.

**Struttura.** Quattro blocchi in sequenza, nessuna funzione ridefinita:
`core` (stato, utilità, codici tributo, modello, validazione) · `io`
(importazione, template, PDF, esportazioni) · `telematic` · `ui`. Nessun
`onclick` inline: tutto passa da `data-action` con delega sul documento, che
toglie alla radice la classe di problemi dell'audit della 0.7.0 invece di
filtrarla. `confirm`, `prompt` e `alert` nativi sostituiti da finestre proprie.

**Coordinate del PDF: non toccarle.** Sono calibrate sul modello ministeriale
in millimetri, tre copie, e sono il risultato di più iterazioni di confronto
con la stampa. Il file incorpora le tre PNG del modello ufficiale (≈600 KB in
totale), quindi **ogni PDF pesa circa 0,6 MB**: cento modelli fanno una
sessantina di megabyte e una ventina di secondi. La generazione dello ZIP
mostra l'avanzamento e restituisce il thread fra un modello e l'altro, e la
schermata di download dichiara il peso previsto prima di partire.

**Funzioni nuove rispetto allo standalone:** libreria di ~70 codici tributo con
descrizione e sezione attesa, estendibile con codici propri dell'utente (codice
sconosciuto o in sezione errata = avviso, mai blocco); «Riprendi dal mese
precedente» (copia struttura, sposta data e periodo, azzera gli importi e **non
copia le compensazioni**); regole ricorrenti per contribuente (codice → flusso,
matricola e sede predefinite), applicate solo dove il dato manca; archivio
crediti; sezioni «Dati e backup» e «Come si usa», che nella 0.9.0 erano
`<section>` vuote; percorso «Prova con i dati dimostrativi»; deep link su tutte
e nove le sezioni.

**L'archivio crediti è dichiarativo, e lo dice.** Il residuo nasce da quello che
l'utente annota meno gli utilizzi che il tool riconosce nei progetti. Non è il
cassetto fiscale: il pannello lo scrive in chiaro. Rileva due cose che il
singolo modello non mostra — l'utilizzo oltre il dichiarato e lo stesso importo
a credito che compare in due F24 della stessa elaborazione.

**Il telematico è dietro una conferma esplicita.** Il tracciato A/M/V/Z non è
mai passato dal modulo di controllo dell'Agenzia: finché non lo fa è una bozza
tecnica. La generazione è disabilitata finché l'utente non spunta di aver letto
l'avviso. È l'unico varco di questo tipo nella suite, ed è voluto.

**Verificato sulla pagina viva:** zero errori JavaScript; import singolo e
massivo; template scaricato e riletto dal parser del tool senza rilievi (stessa
trappola del Bilancio e dell'Analisi); PDF a tre pagine; ZIP di 20 modelli in
4,4 s per 12 MB; 50 società × 40 righe = 2.000 righe e 200 modelli con
`renderAll` in 16 ms; autosalvataggio scritto e **ripristinato**; nessuno
scorrimento orizzontale a 375, 768 e desktop; audit statico del sito 63 pagine,
1.036 link, 0 problemi.

**Attenzione ai dati di esempio.** La P.IVA dimostrativa `01234567894` non
supera il controllo di validità: la cifra corretta è `01234567897`. È lo stesso
inciampo dei template di Bilancio e Analisi — un esempio che non funziona fa
sembrare rotto il tool. Ora l'esempio del template, i dati dimostrativi e il
file di «Configura con AI» usano gli stessi identificativi validi, e il
template pubblicato è **generato dagli stessi header del tool** (`make_template`
legge `TEMPLATE_HEADERS` dal sorgente) proprio per non poter divergere.

## Come si aggancia una pagina applicativa nuova

Costato quattro difetti visibili sul sito pubblicato: la prima versione di
`/tools/f24/` è uscita con l'intestazione rotta perché la verifica era passata
solo da DOM e stato, mai da uno sguardo alla pagina. **Una pagina di tool ha
bisogno di tre fogli, non di uno.**

| Serve | Perché |
|---|---|
| `site-shell.css` | disegna il contenitore dell'intestazione (`.tal-global-header`, `.tal-gh-frame`) e la sua griglia responsive |
| `tal-app.css` | token, controlli, tabelle, sidebar, finestre. **Ritocca** l'intestazione, non la costruisce |
| lo `<style>` di pagina | logo, voci di menu, pastiglie della lingua e pannello `.tal-publication`: stanno nel foglio di ciascun tool, non in quelli condivisi |

Senza il terzo, logo e menu escono come immagine a grandezza naturale ed elenco
di link sottolineati, anche con gli altri due agganciati.

Le altre tre trappole di aggancio, tutte incontrate in quel giro:

1. **Niente classe `btn` sul pulsante del menu.** In `tal-app.css` la regola dei
   bottoni porta `display:inline-flex !important` e sovrascrive il `display:none`
   con cui il pulsante resta nascosto sopra i 980px: risultato, un «☰ Menu»
   piantato sopra al marchio della sidebar a schermo intero. Gli altri quattro
   tool usano `class="sb-toggle"` e basta.
2. **`site-shell.css` allarga l'intestazione a 100vw** con margini negativi.
   Dentro l'area applicativa, già spostata a destra dalla sidebar, sborda. Va
   riportata al contenitore con
   `.app-main .tal-global-header{width:100%!important;margin-left:0!important;…}`.
3. **Gli z-index del sito partono da 5000.** L'intestazione è a `z-index:5000`:
   un pulsante flottante a 70 ci finisce sotto e diventa incliccabile, e la
   sidebar aperta su telefono si fa coprire il marchio. In F24 il pulsante sta a
   `5100`, la velatura a `5050`, la sidebar a `5060` sotto i 980px.

**Navigazione del sito su telefono.** Sotto i 1080px `site-shell.css` nasconde
`.tal-gh-nav` e la riapre solo con `.tal-menu-open` sull'intestazione, classe
che va messa da un pulsante `.tal-gh-menu-toggle` nel markup. Ce l'hanno la
home, LIPE, il Fascicolo e ora F24; **`financial-statement` e
`financial-analysis` no**, quindi su quei due la navigazione del sito è
irraggiungibile da telefono. È un difetto vero e aperto, non una scelta.

## F24 — audit esterno, sette correzioni, 13 agosto 2026

Audit indipendente commissionato da Riccardo. Verificato punto per punto sul
tool in esecuzione prima di intervenire: i quattro P0 sono **tutti
confermati**, uno era più grave di come lo descriveva, e due rilievi si sono
rivelati **infondati**.

**Il difetto peggiore l'audit lo classificava come minore.** Diceva «la demo
contamina gli archivi persistenti». Misurato: li **sovrascriveva**. Un cliente
reale in archivio, un clic su «Prova con i dati dimostrativi», e in
`localStorage` restavano solo ALFA e BETA. Chi aveva cinquanta anagrafiche le
perdeva per curiosità. Ora la demo gira in una sessione isolata: `state.demo`
blocca ogni scrittura dentro `writeStore()`, una fascia dichiara che nulla
viene salvato, e all'uscita gli archivi si rileggono dal browser intatti. Il
blocco sta nella funzione di scrittura, non nei punti che la chiamano: così la
demo è **incapace** di toccare i dati veri, non solo poco propensa a farlo.

**«Compila a mano» non portava da nessuna parte.** Due cause sovrapposte: le
righe create finivano in `activeGroup='draft'`, ma la compilazione guidata
legge `currentGroup()`, che per le bozze è `null` — quindi diceva «Nessuna riga
in questa sezione» mentre le righe esistevano; e **non c'era un solo punto
dell'interfaccia in cui impostare data di pagamento e flusso**, né campo, né
colonna, né voce nei dettagli riga. Un F24 creato a mano restava per sempre su
«Data di pagamento mancante». Riccardo ha scelto entrambe le soluzioni
proposte: una finestra «Imposta il modello» all'ingresso del percorso manuale e
del «＋» della rail, **più** data e flusso modificabili dall'intestazione del
modello, che servono anche a correggere un F24 importato.

Il pezzo tecnico è `state.pendingGroup`: l'F24 impostato ma non ancora
riempito non entra in `groupF24()` — che resta la sola verità su totali,
controlli e output — ma viene ricostruito per la rail e per la guidata **con la
stessa chiave** che avrà da completo. Quando la prima riga diventa completa il
gruppo vero prende il suo posto senza che l'utente veda nulla cambiare.
Attenzione: `renderEditor()` riportava il gruppo attivo a «bozza» perché la
chiave in preparazione non è fra i gruppi; l'eccezione va mantenuta.

**«Pronto» non significava completo.** Mancava il concetto di campo
obbligatorio per sezione, e una riga INPS DM10 senza periodo di riferimento
risultava pronta — nei *nostri* dati dimostrativi. Ora c'è `SECTION_REQUIRED`:
INPS vuole sede, causale, matricola e periodo «da»; IMU codice ente e anno;
INAIL sede, ditta, C.C., riferimento e causale; Regioni il codice regione;
Erario codice e anno. Si ferma **alla sezione** per scelta di Riccardo: le
regole del singolo tributo stanno sulle istruzioni dell'Agenzia e il tool non
le ha verificate, quindi dove il campo dipende dal codice resta un avviso (per
esempio il periodo «a» dell'INPS).

**Le altre tre.** Le date impossibili passavano: `31/02/2026` diventava
`2026-02-31` e finiva nel PDF e nel telematico; ora `isRealDate()` le rifiuta.
Il pulsante «Correggi gli errori» era **disabilitato proprio quando c'erano
errori**: ora è attivo e porta al primo errore. Le finestre stavano a
`z-index` 120 contro i 5000 dell'intestazione di `site-shell.css`, che ne
copriva il titolo: ora 9000.

Più i due dettagli veri: «1 righe» (c'è `plurale()`) e i badge della sidebar
che mostravano numeri senza dire di cosa (ora l'unità sta nel `title` e nel
nome accessibile).

**Cosa non è stato fatto, e perché.** L'audit chiede di spezzare la pagina e
caricare le librerie a richiesta: tutti e cinque i tool sono file unici senza
build su GitHub Pages, e cambiare architettura a uno solo lo scollegherebbe
dagli altri quattro. Chiede di togliere il telematico dalle promesse del
catalogo: il varco con conferma esplicita era già una decisione presa, e
Riccardo ha scelto di aggiungere solo la **dichiarazione delle specifiche**
(`TELEMAT_SPEC`), non il declassamento. Segnala il nome del sito troncato: è
l'ellissi voluta in `tal-app.css`, condivisa dai cinque tool.

**Due rilievi erano sbagliati**, verificati: l'IBAN dell'intermediario **non**
resta visibile quando l'addebito è sui conti dei contribuenti, e i campi
persona fisica e persona giuridica **non** compaiono insieme —
`updateTelematicConfigFields()` viene chiamata all'apertura della finestra.

## F24 — specificità, errori dei moduli e modello a tutta pagina, 14 agosto 2026

Tre segnalazioni: «se imposto un nuovo cliente e schiaccio salva non me lo
salva»; «se sbaglio la P.IVA gli avvisi vengono riprodotti sotto la schermata
e non si leggono»; «da mobile predisporre il Mod. F24 è quasi impossibile».
Più una quarta, guardando lo schermo: «come può una persona lavorare così su
un ritaglio minuscolo? l'F24 deve essere grande».

**Le prime due erano lo stesso difetto.** Il salvataggio non falliva: veniva
**rifiutato** perché mancava il codice fiscale, e il motivo usciva in un
messaggio a scomparsa ancorato al bordo inferiore della finestra — misurato:
`bottom` a 582px su una finestra alta 582 — mentre l'utente guarda i campi in
cima a un modulo alto 1300px. Tre secondi, fuori dal campo visivo, e il
risultato è indistinguibile da un pulsante che non funziona. Ora ogni modulo
ha un riepilogo degli errori **in cima, appiccicato mentre si scorre**: elenca
tutti i rilievi insieme, marca i campi, porta il primo in vista e resta finché
non è stato corretto. Vale per contribuente, credito, nuovo F24 e
intermediario.

**La terza aveva una causa che i controlli non potevano vedere.**
`tal-app.css` veste tutti gli input del tool con
`html.tal-tool-page input:not([type=checkbox]):not([type=radio]):not([type=file])
{min-height:38px !important;padding:8px 11px !important;font-size:13.5px !important}`.
Quella regola vale **(0,4,2)** — i tre `:not([type=…])` contano come classi —
e batteva `.mf-field` (0,1,0) *anche con `!important` su entrambe*. Risultato:
ogni campo del modello forzato a 38px su righe alte 13,8, e **106 campi su 146
sovrapposti**, che coprivano il modello. Non era un difetto solo mobile: era
così anche su desktop, e i miei controlli non lo vedevano perché cercavano
elementi *fuori* dal foglio, non elementi *sovrapposti fra loro*. La correzione
è l'identificatore: `html.tal-tool-page #modelSheet .mf-field` vale (1,2,1) e
vince senza ambiguità. **Un prefisso a base di classi qui non basta.**

**Il modello ora prende tutta la pagina.** In modalità modello spariscono la
rail degli F24 e il pannello laterale dei rilievi: al loro posto una barra con
il menu dell'F24 aperto, sei pulsanti per saltare alla sezione e gli
ingrandimenti; i rilievi diventano una striscia sotto al foglio. La colonna di
lettura passa da 1280 a 1760px (`body.model-focus`). Il foglio è passato da
~530px a 1043px di larghezza, con righe da 20px.

**«Adatta» non scende sotto il compilabile.** Su un telefono un A4 a larghezza
schermo dà righe da sei pixel: guardabile, non compilabile. Ora «Adatta»
riempie la larghezza ma non sotto i 17px di riga (872px di foglio), e gli
ingrandimenti sono multipli di quella base, così «220%» significa la stessa
cosa su ogni schermo. Il corpo del testo dei campi è in `cqw` sul foglio
(`container-type:inline-size`), quindi cresce insieme allo zoom: il fattore
era 0,62cqw, cioè circa metà del necessario, ora è 1,32cqw — l'1,95%
dell'altezza di riga per il rapporto A4.

**Attenzione al rientro in percentuale su elementi in posizione assoluta**
(già annotato, si è ripresentato): si calcola sulla larghezza del contenitore,
non dell'elemento.

## F24 — il modello compilabile e la mappa dei riquadri, 13 agosto 2026

Segnalazione: «la compilazione guidata è pietosa, se metto un codice tributo e
poi ne voglio mettere un altro con aggiungi riga non funziona; il PDF ha i
numeri piccoli e sfasati».

**«Aggiungi riga» non funzionava per una ragione strutturale.** `groupF24()`
filtrava le righe complete **prima** di raggruppare, quindi ogni riga appena
creata nasceva orfana: veniva scritta nello stato e non apparteneva a nessun
F24, perciò non compariva da nessuna parte. È la stessa radice per cui le
righe della compilazione a mano erano invisibili. Ora il gruppo contiene
**tutte** le sue righe e sono totali, controlli, capienza e output a guardare
solo `g.filled`. Il concetto di «bozza» resta, ma vale per le righe **senza
contribuente**, che sono le uniche davvero orfane.

**Il PDF era sfasato per un errore di convenzione.** Le coordinate erano
ricavate a occhio e usate come **linea di base** del testo: per la prima riga
Erario la linea di base stava a 89,20 mm mentre il riquadro finisce a 88,76,
quindi i caratteri cadevano sotto il bordo. E il corpo era 5,7 pt fisso, alto
poco più di un millimetro dentro riquadri da 4,1 mm.

**La soluzione è una mappa misurata, non stimata.** `f24_map.js` contiene i
riquadri in millimetri su A4, ricavati dall'immagine ufficiale del modello
(2481 × 3508 px) isolando le caselle bianche sul fondo azzurro. Da quella
mappa nascono **sia il PDF sia il modello compilabile**: dove l'utente scrive
è, per costruzione, dove il dato verrà stampato. Il corpo si calcola
sull'altezza del riquadro (circa 9 pt invece di 5,7) e si riduce da solo
quando il contenuto è più largo dello spazio; la linea di base centra il testo
verticalmente. Verifica: `verifica_mappa.py` ridisegna i riquadri e il testo
sull'immagine del modello e conta quanti escono — zero su 163.

**Le due viste sono cambiate di nome e di ruolo.** «Righe» è diventata
**«Compila riga per riga»** ed è la vista predefinita. «Compilazione guidata»
è stata **eliminata** e sostituita da **«Compila sul Modello F24»**: il modello
ministeriale con un campo sopra ogni riquadro reale, in cui si clicca e si
scrive. Nessuna tabella o pannello di sezione accanto — solo il modello e, a
lato, i rilievi agganciati alla riga. Le righe si creano scrivendo nel
riquadro successivo: «Aggiungi riga» lì non serve più. Anagrafica, totali e
saldi sono calcolati e non scrivibili, per non avere due verità sullo stesso
dato.

Con la vista guidata sono usciti anche `SECTION_FIELDS`, `visualSection` e
`previewScale`: codice morto, rimosso.

**Attenzione al rientro in percentuale su elementi in posizione assoluta.**
`padding-right:20%` sui campi importo si calcolava sulla larghezza del
**foglio**, non del campo: 101 px su un campo da 67 px. In `em` segue il corpo
del testo ed è corretto. Stesso inciampo su `.mf-static`, che senza
`box-sizing:border-box` sbordava.

## F24 — audit d'uso e cinque correzioni, 13 agosto 2026

Segnalazione dell'utente: «se creo un F24 per IMU o INPS non si vedono i
dettagli dei campi, e se premo + per entrarci non posso scorrere». Due sintomi,
due cause distinte, più altre tre emerse ripercorrendo il tool a mano.

1. **Tutte le finestre tagliavano il contenuto, senza barra di scorrimento.**
   `tal-app.css` dichiara `html.tal-tool-page .modal{overflow:hidden}`, che per
   specificità batteva `.modal{overflow:auto}` del foglio di pagina. Il
   dettaglio di una riga IMU perdeva **414px**, quello di una riga **Erario
   226px**: il pulsante «Salva dettagli» non era raggiungibile per nessuna
   riga, quindi la funzione era inutilizzabile in blocco. Colpiva anche
   l'anagrafica (232px) e la configurazione telematica (153px). Ora
   `overflow-y:auto !important` e i pulsanti in `position:sticky` in fondo,
   così in una finestra lunga non si va a caccia del salvataggio.
2. **La compilazione guidata mostrava gli stessi cinque campi per tutte e sei
   le sezioni** (codice, periodo, anno, debito, credito). I flag IMU, la
   matricola INPS, il codice ditta INAIL, il codice ente degli altri enti e il
   codice regione non erano esposti da nessuna parte se non dalla finestra di
   cui sopra — cioè da nessuna parte. Ora ogni sezione ha i suoi campi,
   descritti in `SECTION_FIELDS`, con le caselle raggruppate su una riga
   propria come la fila di quadratini sul modello. È quello che chiedeva il
   §10 del brief e che la 0.9.0 non aveva mai fatto.
3. **Cambiando sezione a una riga restavano i campi della sezione lasciata**
   (numero immobili, flag, codice ditta…), e finivano nel PDF e nel tracciato
   telematico di una sezione che non li prevede. Ora vengono azzerati e il
   tool dice quanti campi ha toccato. L'elenco è in `SECTION_ONLY_FIELDS`.
4. **La ricerca diceva «Cerca nel progetto» ma guardava solo l'F24 aperto**:
   chi cercava un codice presente in un altro modello concludeva che non
   c'era. Ora le corrispondenze fuori dall'F24 corrente vengono elencate sotto
   la barra, con il collegamento per raggiungerle.
5. **Le finestre si impilavano**: la richiesta di ripristino del salvataggio
   automatico poteva aprirsi sopra a un modulo già compilato, ed Escape le
   chiudeva tutte insieme facendo perdere il lavoro. Ora il ripristino non
   compare se c'è una finestra aperta o se il lavoro è già avviato, ed Escape
   chiude solo quella in primo piano.

**Lezione di metodo, la stessa della volta prima.** Tutti e cinque i difetti
erano invisibili ai controlli automatici che avevo scritto: gli elementi
esistevano, rispondevano, il contrasto era a posto, non c'erano errori in
console. Un tool si verifica **usandolo**, non interrogandolo.

## Contrasto — due correzioni nel layer condiviso, 13 agosto 2026

L'audit di contrasto precedente dichiarava «nessun fallimento su 4 tool», ma
**non risolveva i gradienti**: quando il fondo era un `background-image` e non
un `background-color`, risaliva la catena dei genitori fino alla carta chiara e
misurava il rapporto contro quella. Due difetti veri erano invisibili a quel
metodo. Il misuratore corretto prende, di un gradiente, **il colore più scuro
fra gli stop**, cioè il caso peggiore.

1. **`.sb-logo`** (il monogramma della sidebar, tutti e cinque i tool): testo
   `#08252F` su `#4FCBE4 → #1D6A7F`. Angolo chiaro 8,35:1, angolo scuro
   **2,60:1**. Secondo stop portato a `#3FA6C0` → **5,64:1**, e resta più scuro
   del primo, quindi il rilievo del gradiente non si perde. Non è stata toccata
   `--tal-accent-2`: serve altrove su fondi chiari.
2. **`.badge.dark`** (solo LIPE, tre occorrenze): stava nello stesso elenco
   delle pastiglie che vivono dentro `#sidebar`, `.summary-bar` e simili, ma
   **per il nome, non per il contesto**. In LIPE sta dentro `.panel-heading`,
   cioè su una scheda bianca: testo `#F7F7F5` su una velatura chiara sopra il
   bianco, **1,07:1**, di fatto invisibile. Ora ha un fondo `var(--tal-ink)`
   vero → **16,04:1**.

Esito dopo le correzioni, con il misuratore che risolve i gradienti:

| Tool | Elementi con testo | Fallimenti |
|---|---:|---:|
| Bilancio civilistico | 74 | 0 |
| Analisi di bilancio | 103 | 0 |
| Generatore LIPE | 113 | 0 |
| Fascicolo cliente | 91 | 3 (`.chev`, decorativo — vedi Aperto) |
| Generatore F24 | 608 | 0 |

**Attenzione al `?v=` durante lo sviluppo.** Il numero è stato portato a
`20260813` su tutte e cinque le applicazioni. In produzione basta: nessun
visitatore ha mai scaricato quella versione. In locale invece la pagina F24
usava già `?v=20260813` prima che il foglio cambiasse, quindi il browser
serviva il contenuto vecchio sotto lo stesso indirizzo e le misure risultavano
invariate. Per verificare una modifica al foglio condiviso, sostituire il
`<link>` con uno che porti una query casuale, altrimenti si misura la cache.

## Concept condiviso — cinque correzioni d'uso, 14 agosto 2026

Segnalazioni di Riccardo su tutti e cinque i tool, più cinque sul solo
Bilancio. Le prime cinque vivono nel layer condiviso (`tal-app.css`,
`tal-app.js`, portati a `?v=20260814`): toccarle lì significa non doverle
ripetere quando nasce il sesto tool.

**1. L'ingresso non è più occupato da qualcun altro.** Aprendo il Bilancio si
trovava l'Anagrafica già compilata con «Alfa Industriale S.r.l.», la sua
P.IVA nella scheda «Salva il fascicolo corrente» e un anno proposto: era la
bozza `fs_draft_v1` ripristinata in silenzio da `restoreDraft()`. Stessa cosa
in LIPE (`taxtool_lipe_v3_session` + `_work`) e nel Fascicolo, che riapriva
direttamente l'ultimo cliente. Il lavoro **non si butta**: resta dov'è e
viene offerto da una fascia gialla (`.tal-resume`) con «Riprendi» e «Scarta».
La bozza viene tenuta anche in memoria, così scrivere in un campo — che
riscrive `fs_draft_v1` — non fa perdere la possibilità di riprenderla.
`refreshSaveCard` non propone più l'anno solare: senza data di chiusura in
Anagrafica il campo resta vuoto, perché un anno inventato è peggio di un
campo vuoto. `financial-analysis` non persisteva nulla e F24 chiedeva già
(«Riprendere il lavoro?»): lì non c'era niente da correggere.

**2. Una sola barra di sessione, sottile, con i colori del sito.** Bilancio e
Analisi ne avevano due impilate — la propria «Sessione di lavoro» più la
`.tal-cmdbar` condivisa — e la seconda ripeteva il nome della società che
sta già nella sidebar: 117px per dire due volte la stessa cosa. Ora è una
striscia sola, **41px** su desktop e 80 su telefono, viola `#5B3A8C` →
petrolio `#145368`. Il contesto duplicato resta **nel DOM** (i tool ci
scrivono dentro: toglierlo romperebbe `updateCommandLabel`, `#cmdMeta` e
simili) ma è `display:none`. `tal-app.js` adotta la barra del tool se c'è e
ne costruisce una solo dove manca. **Attenzione all'ordine di boot:**
`tal-app.js` è `defer` e gira *prima* del listener `DOMContentLoaded` che
crea la barra di Bilancio e Analisi — da qui `boot()` con `setTimeout(…,0)` e
`reconcileBar()`, che toglie la barra sintetica se ne compare una vera.
Attenzione anche al `flex-direction:column` che quei due fogli mettono sotto
i 620px: senza forzare `row` la striscia torna a tre righe.

**3. «Informazioni sullo strumento» sta in «Come si usa».** Il pannello
`.tal-publication` era in cima a *ogni* schermata di ogni tool. Ora
`tal-app.js` lo sposta nella sezione di aiuto — `#view-help`, `#view-method`,
`#lipe-help`, `#stage-guide` — e lo apre. LIPE costruisce la sua a runtime,
quindi il tentativo si ripete fino a dodici volte a 400ms. Fuori da lì il
pannello è nascosto dalla CSS, così non lampeggia al caricamento.

**4. Il colore dice cosa fa il pulsante.** Verde aggiunge, arancio modifica —
era la regola del Fascicolo, ma solo Fascicolo e F24 la applicavano (36 e 8
pulsanti; gli altri tre, **zero**). Marcarli a mano era impraticabile: la
maggior parte nasce a runtime dentro stringhe HTML. La classificazione è per
**etichetta**, in `tal-app.js`, con un `MutationObserver` per quelli nuovi.
Il terzo caso, il salvataggio, prima non esisteva: ora è `.btn.save`, viola
sfumato in petrolio, gli stessi colori della barra di sessione perché è la
stessa azione. Override per pulsante con `data-tal-tone="add|edit|save|none"`.
Esclusi di proposito: la sidebar, le schede, i menu a tendina e **la barra di
sessione** — lì «Nuovo» azzera l'elaborazione, e verniciarlo di verde direbbe
l'opposto di quello che fa. Esclusa anche «Nuova elaborazione», per la stessa
ragione. I comandi di riga (`.lk`) prendono il colore del testo, non il
fondo: riempirli trasformerebbe una tabella in una scacchiera.

**5. «Configura con AI» apre una scheda nuova.** Era un link normale in mezzo
alle voci di menu della sidebar: cliccarlo portava via la sessione di lavoro.
Il link nell'intestazione del sito resta com'è, perché lì è navigazione.

**Gronda doppia su «Chi sono».** Nella home a pagine (`index.html` e le due
tradotte) `.page` porta `padding-top:54px` e `.page-header` prende i
`clamp(40px,6vw,76px)` del ritmo condiviso: si sommavano, e «Chi sono»
partiva **125px** sotto l'intestazione contro i **76px** di `/tools/` e
`/approfondimenti/`. La stessa somma era già stata corretta per la sola home
(`.page[data-page="home"]`) e mai per le altre. Ora il contenitore non mette
gronda dove c'è già un'apertura: `.page:has(.page-header){padding-top:5px}`.
I 5px non sono un capriccio — dentro la home l'intestazione appoggia 10px
più in basso della sua posizione di flusso e il contenitore la rincorre di
5. Misurato sulla pagina: 76px su desktop e 40px a 375, identici agli altri.

**Un difetto trovato per strada.** `tal-app.js` sostituiva
`localStorage.setItem` sull'istanza, e in Chrome quello **scrive una chiave
vera di nome `setItem`** dentro l'archivio dell'utente — che finiva anche nei
backup JSON. Ora la sostituzione è su `Storage.prototype`.

## Bilancio ITA GAAP 1.4.1 — cinque correzioni, 14 agosto 2026

**«Bilancio riclassificato» → «Bilancio ITA GAAP»**, in sidebar e in
intestazione di sezione. Le otto schede erano in fila e mettevano sullo stesso
piano cose che non lo sono; ora sono tre gruppi con l'etichetta sopra:
**Viste** (Stato Patrimoniale · Conto Economico · Prospetto di deposito),
**Strumenti di lavoro** (Riclassifica per conto · Non mappati · Storni ·
Rettifiche IAS→OIC), **Controllo** (Verifiche). `showTab` cerca
`#results_tabs .tab`, quindi annidarle nei gruppi non ha richiesto di
toccarla.

**«Riclassifica per conto» era una tabella da guardare.** Mostrava i conti e
la voce assegnata e finiva lì: per cambiare una voce si doveva passare da
«Non mappati» — che elenca solo i conti *senza* voce — o trascinare la riga
nello schema. Ora ogni riga ha la sua casella di scelta, con un filtro di
ricerca e due viste ridotte (solo senza voce, solo con riclassifiche
parziali). Svuotare la casella non «smappa» il conto: rimette la voce che
portava dal file, e l'etichetta lo dice.

**La riclassifica parziale è uno storno, non un motore nuovo.** «Sposta una
parte…» chiede voce di destinazione e importo (corrente e, se serve,
precedente) e scrive uno storno con `partial:true`, `accCode` e `accKey`:
stessi controlli di quadratura, stesso posto negli export, e compare come
sotto-riga sotto al conto con il suo «Annulla». Bloccata sui conti senza
voce, perché senza voce di partenza lo spostamento sbilancerebbe il bilancio.
Avvisa — non blocca — se l'importo supera quello del conto.

**Le rettifiche avevano quattro colonne** — Dare corr., Avere corr., Dare
prec., Avere prec. — e le prime due si confondevano con le seconde. Le
colonne dell'esercizio precedente sono uscite da tabella ed editor. Gli
importi già scritti **non vengono cancellati**: `collect()` li rilegge dalla
rettifica di partenza riga per riga (senza quello, salvare una modifica li
azzerava in silenzio) e una nota sotto la scheda li dichiara. Accanto a
«Nuova rettifica» e «Parti da un modello» c'è ora **«Rettifiche esercizio
precedente»**: legge `fs_archive_v1`, prende il fascicolo dell'anno
precedente più vicino a quello in corso e permette di riportarne una
selezione. Arrivano `active:false` e `carried:true`, come vuole la regola già
scritta per «Crea nuovo anno».

**La mappatura si salva dal comando in alto.** `saveCurrent` è chiusa dentro
l'IIFE della barra comandi e **non è una proprietà di window** — avvolgerla
da fuori non funziona, verificato. Il punto comune alle due strade è
`#fs_save_btn`, perché il Salva della barra gli fa `click()`: l'aggancio è
lì. La scrittura è silenziosa, così il messaggio che resta a schermo è quello
del fascicolo.

## Concept condiviso — la barra unica e i cinque tool allineati, 14 agosto 2026

**I tre comandi di sessione ora esistono ovunque.** Bilancio e Analisi
avevano Nuovo · Salva · Archivio; LIPE e F24 avevano solo etichetta e stato,
il Fascicolo teneva gli stessi tre comandi sepolti nel menu «Altro» fra altre
nove voci. Ora la barra la disegna `tal-app.js` e ogni tool dichiara che cosa
significano i tre verbi da lui, in `window.TAL_SESSION`:

```js
window.TAL_SESSION = { onNew, onSave, onArchive, hints:{…} }
```

Il valore può essere una funzione **o il selettore di un comando che il tool
ha già cablato** — nel Fascicolo i tre premono le voci di `#cmdMenu`, così
non esistono due implementazioni della stessa azione. `hints` diventa il
`title`: la parola è la stessa nei cinque tool, quello che fa cambia (in F24
«Salva» scarica un file, il lavoro in corso è già tenuto dal salvataggio
automatico) ed è giusto dirlo invece di lasciarlo intuire.

**Due difetti di intestazione chiusi.** In Analisi il pannello «Interfaccia
operativa in italiano.» stava sopra il contenuto di ogni schermata: rimosso.
Sempre in Analisi, `installV17Dom` iniettava un secondo **«Salva lavoro»**
dentro l'intestazione del sito, con il suo indicatore di stato: due Salva
sulla stessa schermata, e lo stato lo dice già la pastiglia della barra.
Rimosso il pulsante; `manualSaveV17` resta viva, e `saveWork` — che è quello
che chiama la barra — fa di più (valida denominazione/P.IVA e scrive
nell'archivio), quindi non si è perso niente.

**Il cambio lingua nei tool.** Quattro tool su cinque mandavano ENG e ESP al
**catalogo** `/en/tools/` e `/es/tools/` invece che alla pagina di *quel*
tool nell'altra lingua: si cliccava ENG dentro il Bilancio e si finiva
sull'elenco degli strumenti. Le dieci pagine per-tool esistevano già (`en/` e
`es/`, con le pastiglie corrette in entrambe le direzioni) e solo F24 le
usava. Ora le usano tutti e cinque.

**Esito della verifica di omogeneità**, misurata sui cinque tool in
esecuzione: barra 42px con lo stesso gradiente viola→petrolio e gli stessi
tre comandi; zero pulsanti nell'intestazione del sito; nessun avviso di
interfaccia; «Informazioni sullo strumento» dentro «Come si usa» (il
Fascicolo non ha quel pannello: tiene la voce ⓘ nel menu); pastiglie di
lingua sulle pagine proprie; nessuno scorrimento orizzontale.

## LIPE 3.6.0 — l'import unico, e il difetto che lo rendeva inutile

Segnalazione: «se vado su clienti, importa da excel e scarico excel devo per
forza selezionare una società; come faccio a configurare un cliente nuovo e
il suo codiciario?».

**Il percorso d'ingresso portava nel posto sbagliato.** La scheda «Importa da
Excel» della schermata Clienti saltava a «Elaborazione periodica», cioè
all'import degli **importi del periodo**, che per sapere mesi e periodicità
ha bisogno di un cliente che esista già — e un cliente nuovo, per
definizione, non c'è. Il file che serve per primo (anagrafica + codiciario,
un solo workbook, come il template del Bilancio) c'era già, ma stava più in
basso nella pagina e **nessun percorso d'ingresso ci portava**. Ora ci
portano la scheda d'ingresso e una voce di sidebar «Importa da Excel», nel
gruppo Configurazione come negli altri tool.

**Il difetto vero l'ha fatto emergere il percorso, non la lettura.** Il
codiciario si rileggeva per nome di colonna normalizzato, e la
normalizzazione butta via tutto ciò che non è lettera o cifra — **«%»
compreso**. Così `Imponibile →` e `% imponibile` diventavano la stessa chiave
`imponibile`, e la seconda copriva la prima: al posto del rigo VP arrivava la
percentuale, `routeValue(100,['VP2','VP3'])` restituiva stringa vuota e
**ogni codice tornava senza destinazione**, cioè escluso dal quadro VP. Vale
per tutte e tre le coppie. Conseguenza: il template scaricato dal tool e
ricaricato senza toccarlo perdeva ogni destinazione, e il file di «Configura
con AI», che ha le stesse intestazioni, faceva la stessa fine. È questo il
«non gestisce la configurazione» della segnalazione.

La rilettura ora lavora **per indice di colonna** e riconosce le colonne
percentuale *prima* di normalizzare, guardando se l'intestazione comincia per
«%». Le intestazioni del template **non sono state cambiate**, di proposito:
i file già prodotti dall'AI continuano a funzionare.

**Un file, un cliente.** L'import riempiva i campi e si fermava lì: il cliente
restava inesistente finché qualcuno non premeva Salva. Ora, se il foglio
Anagrafica porta denominazione e P.IVA valida, la configurazione viene
salvata, resa attiva e il contesto della sidebar aggiornato nello stesso
gesto. Se il salvataggio non va a buon fine il messaggio non lo dichiara
comunque: si guarda l'archivio prima di dirlo.

E il template degli importi non si limita più a rifiutare: se in archivio c'è
un solo cliente lo sceglie, se non ce n'è nessuno dice cosa fare e porta
all'import della configurazione.

**Provato sul tool in esecuzione**, non sul sorgente: workbook Anagrafica +
Codiciario → cliente creato e attivo, tre codici con le destinazioni intatte
(`V22→VP2/VP4`, `A22→VP3/VP5`, `RC22→VP3/VP4/VP5`) → import degli importi →
quadro VP con VP2 100.000, VP3 50.000, VP4 24.200, VP5 11.000, VP6 13.200.

## La striscia d'avviso e il menu «Altro», 14 agosto 2026

Due residui che rompevano l'omogeneità appena raggiunta.

**«Strumento sperimentale» in cima a ogni schermata.** Ce l'avevano il
Fascicolo (striscia compatta, visibile) e LIPE (riquadro pieno, già nascosto
da `tal-app.css` ma ancora nel sorgente). Rimossa da entrambi, con la sua CSS:
il disclaimer sta nel piede di **ogni** pagina e per esteso in «Come si usa»,
quindi non si è perso niente — si è smesso di ripeterlo davanti a chi sta
lavorando. Nel Fascicolo «Come si usa» ha assorbito anche le altre due
finestre che dicevano cose vicine, `aboutModal` e `safetyModal`: erano tre
porte sullo stesso discorso.

**Il menu «Altro» del Fascicolo.** Undici voci in un dropdown ancorato a
destra della barra: su telefono restava fuori. Sciolto:

| Voce | Dove sta ora |
|---|---|
| Nuovo cliente · Salva ora · Elenco clienti | i tre comandi della barra di sessione |
| Importa Excel · Dati e backup · Come si usa | erano già nella sidebar |
| Apri nuovo esercizio · Situazione a una data · Data efficacia | nuovo gruppo «Esercizio e date» nella sidebar |
| Stampa la pagina | gruppo «Risultati e dati», accanto a Esporta |
| Informazioni sullo strumento | dentro «Come si usa» |

Con il menu è sparito anche il pulsante **Esporta** della barra, che
duplicava la voce già presente nella sidebar. La barra del Fascicolo è ora
identica alle altre quattro: etichetta, Nuovo, Salva, Archivio, pastiglia.

**Attenzione, e mi è costato un difetto vero.** `window.TAL_SESSION` del
Fascicolo era cablato sui **selettori** delle voci di `#cmdMenu`
(`onSave:'#cmdMenu [data-action="save-now"]'`): premeva un pulsante nascosto
invece di chiamare una funzione. Cancellato il menu, i tre comandi della
barra sarebbero morti in silenzio. Ora passano da `window.tfaRunAction`, che
espone il dispatcher `runAction` fuori dall'IIFE. **Agganciarsi a un elemento
del DOM per invocare una funzione è una dipendenza invisibile**: si rompe
quando il DOM cambia, e non lo dice nessuno.

Tre altri riferimenti agli elementi cancellati avrebbero lanciato:
`$('#cmdMenu')` nella gestione di Escape, `$('#cmdExport').disabled` in
`updateShell`, e l'handler `#cmdMore`. Le voci che pretendono un cliente ora
si spengono insieme in `updateShell` invece di accettare il clic e rispondere
con un avviso.

Verificato in pagina: barra a 41px su tutti e cinque i tool con le stesse
quattro parti, `tfaRunAction` risponde su tutte e sette le azioni spostate,
nessun errore in console, nessuno scorrimento orizzontale, e a 375px i tre
comandi del Fascicolo sono tutti dentro lo schermo (77px di barra contro gli
80 del Bilancio).

## Audit pre-pubblicazione — le correzioni del 21 agosto 2026

L'audit esterno del 21 agosto (quattro P0, nove P1, dodici P2/P3) è stato
verificato rilievo per rilievo sul codice **in esecuzione**, non sul sorgente.
La maggior parte reggeva. Tre rilievi no, e vale la pena sapere quali, perché il
modo in cui sbagliavano si ripeterà:

- il template del Bilancio **aveva già** il campo «Schema di bilancio» vuoto: il
  difetto era nell'app, che ci metteva «abbreviato» di suo;
- `html2canvas` era elencata fra le dipendenze da dichiarare: **non è
  distribuita**, sono agganci opzionali dentro jsPDF, zero banner di copyright
  nei file. Contare, non fidarsi;
- il template importi di LIPE veniva descritto leggendo `downloadAmountsTemplate`
  alla riga 1065, che è **sovrascritta** più sotto. Il rilievo restava valido, ma
  per caso: l'involucro finisce per chiamare la versione con le righe demo.

### Le due trappole nuove, che costano più delle altre

1. **Le definizioni sovrapposte valgono anche per i gate.** In LIPE `buildXml` è
   definita **quattro** volte in successione. Ho scritto il controllo sugli esiti
   AI nella prima e non faceva niente. La forma robusta è un **involucro finale**
   in coda al file:

   ```js
   (function(){ var base=window.buildXml; window.buildXml=function(){
     var out=base.apply(this,arguments); /* aggiungi qui */ return out; };
     try{buildXml=window.buildXml;}catch(_){ } })();
   ```

   Serve anche riassegnare il binding nudo, non solo `window.*`: le funzioni
   chiamanti usano l'identificatore, non la proprietà.

2. **Un gate può essere già morto e nessuno lo sa.** In `financial-analysis` la
   `exportExcel` viva cerca il gate con
   `typeof v18RequireExportGate==='function'`, ma quella funzione è dichiarata
   **dentro un altro IIFE**: da lì `typeof` vale `'undefined'`, la condizione è
   falsa e il gate **non viene mai eseguito**. Il controllo vivo è la `gate()`
   usata da `protect()`, che avvolge tutti e otto gli export e le stampe. Il
   controllo di quadratura scritto in `v18HardGate` era quindi inerte da tempo —
   per fortuna `gate()` ne fa uno equivalente. **Provare chiamando, non
   leggendo.**

### Cosa è cambiato, per rilievo

| Rilievo | Cosa era | Cosa è ora |
|---|---|---|
| P0-01 menu mobile | forma e posizione decise da ogni tool: il Fascicolo in basso con safe area, Bilancio e LIPE a `top:12px`, Analisi e LIPE con `top` ricalcolato da header e barra via `--tal-tool-menu-top` e un ResizeObserver, e Analisi lo **nascondeva** a menu aperto | una sola definizione in `tal-app.css`: quadrato 44×44, sola icona, in basso a sinistra con safe area. Rimossi gli override locali e la variabile. `--tal-global-header-height` resta, la usa lo scroll-padding |
| P0-02 righe demo F24 | `PAGAMENTI` con 5 pagamenti attivi di ALFA/BETA (54.500 a debito, 2.000 a credito), nel file distribuito **e** nel template generato | `PAGAMENTI` vuoto; esempi in `ESEMPI_NON_IMPORTARE`; l'importatore salta i fogli di esempio anche nel ripiego e riconosce le righe campione per impronta completa (nome + identificativo + sezione + codice + importi), non per il solo codice fiscale — una partita IVA valida può appartenere a un cliente vero |
| P0-03 righe demo LIPE | `downloadAmountsTemplate` generava 4 movimenti già valorizzati, nel contesto di un cliente selezionato | foglio `Importi` vuoto, esempi separati, filtro anti-demo, e `setPeriodRows` dichiara i movimenti **prima → dopo** |
| P0-04 telematico F24 | l'audit chiedeva di disabilitarlo | **non toccato**, per decisione di Riccardo del 21 agosto: resta dietro la conferma esplicita, come deciso il 13 agosto |
| P1-01 escape nel Fascicolo | 27 sequenze letterali sulla **riga 406**: due nodi di testo visibili sopra l'header (i due caratteri di escape visti nello screenshot iPhone) e 25 dentro il CSS, dove un escape prima del selettore diventa un `n` attaccato (`n.manage-grid`) e uccide la regola | riga riparata. Effetto collaterale non previsto dall'audit: `.manage-grid`, `.manage-card` e `.client-search` esistevano **solo** lì, quindi l'elenco clienti era senza stile e nessuno l'aveva notato |
| P1-02 Esiti AI | solo il Bilancio leggeva il foglio | lettore condiviso `window.TAL_AI` in `tal-app.js`; Analisi e LIPE lo importano, lo persistono (`STATE.extra.aiFindings` e record cliente), lo esportano, e le eccezioni **bloccanti** fermano export e XML |
| P1-03 schema abbreviato | menu preselezionato, template con «abbreviato», e qualunque valore non contenente «ordinar» diventava abbreviato — anche un campo scritto male | opzione «— da scegliere —», template vuoto, import che non inventa, e gate che blocca l'export finché la scelta manca |
| P1-05 versioni | Bilancio 1.4.0 dichiarato e 1.4.1 nel codice; Analisi 2.1.0 e 2.0.4 in tre costanti; Fascicolo senza `data-tool-version` | una sola versione per tool, e `tests/version-coherence.test.mjs` che fallisce alla prima divergenza |
| P1-06 nessuna CI | un solo test statico, eseguito a mano | `.github/workflows/ci.yml`, `tests/version-coherence`, `tests/prompt-template-contract` (apre gli `.xlsx` e conta le righe), `tests/responsive-harness.html` e `tests/responsive.e2e.mjs` su 5 tool × 7 larghezze |
| P1-07 mapping LIPE | il template precompilava V22/A22/RC22/FC con destinazioni VP attive quando il cliente non aveva codiciario | `Codiciario` esce con i soli codici del cliente; se non ne ha, vuoto. Esempi nel foglio ignorato |
| P1-08 limiti file | Analisi 15 MB, LIPE 25, Fascicolo 12/6/25, F24 5, **Bilancio nessuno** | contratto condiviso `window.TAL_LIMITS`, dichiarato in pagina prima del caricamento; il Fascicolo tiene le sue soglie più strette sugli allegati |
| P1-09 licenze | mancava JSZip 3.10.1 (vendorizzata in Analisi e F24) e F24 non era fra i tool MIT | `THIRD-PARTY-NOTICES.txt` riscritto con la matrice per tool, e F24 aggiunto nelle tre lingue |
| P2-02 working paper LIPE | nessuna larghezza di colonna: «Verifiche» tagliava etichette e descrizioni | `wpAdd` imposta larghezze, riga bloccata e autofiltro su tutti i fogli |
| P2-04 skip link | solo Analisi, con implementazione propria | in `tal-app.js` per tutti e cinque, idempotente, con `tabindex="-1"` sul bersaglio: senza, in Safari il fuoco non si sposta e il salto sembra funzionare senza servire |
| P2-05 overflow Analisi | `.tal-commandbar` dichiarava `width:min(1200px,100% - 36px)` presumendo 18px di margine per lato, mentre `tal-app.css` li porta a 44: 8px fuori dal contenitore | larghezza rimossa, la geometria la decide solo il layer condiviso. Era l'unico tool con un foglio locale per la barra |
| P2-07 console homepage | il modulo WebGL dal CDN veniva scaricato anche dove non poteva servire | controllo di capacità prima dell'import; il fallback canvas resta identico |
| P2-08 template | pochi blocchi riquadri e filtri | riga di intestazione bloccata e autofiltro nei template generati e nel working paper |
| P2-10 sitemap | 36 URL su 44 dichiaravano il 4 agosto | `tests/build-sitemap.mjs`, che prende le date da git, con `--check` in CI |
| P3-01 grammatica | «benchmark validi disponibili per il 0% dei pesi» | caso zero distinto, e niente articolo davanti al numero |

### Le regole comuni nei prompt di «Configura con AI»

Tutti e cinque i prompt italiani portano ora, in testa, lo stesso blocco di
dieci regole: leggere prima `ISTRUZIONI`, usare solo le evidenze, non correggere
gli identificativi, ignorare gli esempi, non lasciare default non sostenuti,
lasciare vuoto il dato ambiguo aprendo un esito bloccante, citare la fonte,
riconciliare i conteggi delle righe, non rinominare fogli e colonne, non
dichiarare completo un lavoro con esiti aperti. Nel prompt F24 è stata anche
riscritta la regola sul saldo netto: se la fonte non distingue debito e credito,
**entrambe** le colonne restano vuote e il caso diventa bloccante. Prima diceva
«riporta il dato come lo trovi», che voleva dire scegliere una colonna a caso.

Un test verifica che le dieci regole ci siano in tutti e cinque i prompt.

### Difetti trovati durante la correzione, non presenti nell'audit

- **LIPE scorreva in orizzontale a 320 e 360 px** (42 e 2 px). La regola a
  `max-width:720px` usava `grid-template-columns:1fr` invece di
  `minmax(0,1fr)`: `1fr` ha un minimo implicito di `min-content`, quindi la
  colonna restava a 303px dentro una griglia da 235. Le altre due regole della
  stessa cascata usavano già `minmax(0,…)`.
- **L'elenco clienti del Fascicolo era senza stile**, conseguenza della riga 406
  (vedi P1-01 sopra).
- **Il Fascicolo teneva l'header compatto quasi sempre — corretto.** `apply()`
  compattava quando `.app-main` scendeva sotto 1220px, ma la sidebar ne toglie
  circa 258: la soglia si raggiungeva solo oltre i ~1500px di viewport, quindi
  su un portatile normale la navigazione del sito era **sempre** dietro
  l'hamburger e il ramo con le voci in linea era di fatto irraggiungibile. Era
  l'unico dei cinque tool così. **Allineato il 21 agosto** su decisione di
  Riccardo: la soglia è ora 760px di **viewport**, la stessa di
  `@media(max-width:760px)` in `site-shell.css` e nel foglio locale
  dell'intestazione. Sopra i 760px l'header è identico a quello di Bilancio,
  Analisi, LIPE e F24; sotto, la compattazione entra e coincide con quello che le
  media query già facevano — logo a 34px, padding stretti, selettore lingua a
  tre colonne. Verificato: a 1280px nessun `tal-compact`, hamburger nascosto,
  navigazione in linea, barra comandi a 96px; a 700px compatto, hamburger
  raggiungibile, barra comandi `position:relative` (quindi l'offset a 72px non
  entra in conflitto). Si misura il viewport e non `.app-main` proprio perché il
  confronto deve essere con gli altri tool, che guardano il viewport. Il
  listener `resize` c'è **in aggiunta** a quello della media query: se la pagina
  nasce a larghezza zero e viene allargata dopo — succede dentro un iframe, ed è
  così che l'ha scoperto l'armatura di test — l'evento `change` non sempre
  arriva.
- **`Prompt_F24_AI_v1.0.txt` è una seconda copia** del prompt della pagina,
  linkata da `/en/` e `/es/`, e poteva divergere in silenzio. Ora
  `tests/prompt-template-contract.test.mjs` le confronta e fallisce se
  divergono. Il `.txt` è stato risincronizzato: porta le dieci regole comuni, il
  blocco «PRIMA DI COMINCIARE» e la regola corretta sul saldo netto.
- **Sette `.txt` di prompt obsoleti rimossi il 21 agosto**, su decisione di
  Riccardo: i quattro doppioni di Analisi (`v2.0.0`, `v2.0.1`, `v2.0.2`,
  `v2.0.4`) e i tre del Bilancio (`v1.3.1`, `v1.3.3`, `v1.3.4`). Nessuno era
  linkato da alcuna pagina, tutti erano raggiungibili per URL e avrebbero
  servito istruzioni superate a chi ci arrivava. Erano tracciati in git, quindi
  restano nella storia. **Restano due `.txt`**: quello F24, che è linkato, e
  `Prompt_Fascicolo_Fiscale_Cliente_AI_v1.0.txt`, che non è linkato da nessuna
  pagina ma è l'unica versione esistente per quel tool e non ha successore — se
  serve, va linkato dalla card del Fascicolo; se non serve, va cancellato anche
  quello. Non l'ho deciso.

### Cosa resta aperto dell'audit, e perché

- **P1-04, golden test ufficiali**: XML LIPE dal software di controllo
  dell'Agenzia, tracciato F24A0 dal modulo F24A0, XBRL da TEBENI. Non è
  automatizzabile qui: sono strumenti esterni, si eseguono a mano e si conserva
  l'esito — versione del controllo, data, hash del file, risultato. Fino ad
  allora `validatoConModuloUfficiale` resta `false` e la generazione resta
  dietro la conferma.
- **P2-01, pagina 2 quasi vuota nel PDF working paper del Bilancio**: serve
  logica di preflight sui salti pagina in jsPDF, non una riga di CSS. Da fare
  con un confronto visivo prima e dopo.
- **P2-03, PDF non taggati**: jsPDF non produce PDF/UA. O si dichiara il limite
  nella pagina, o si cambia catena di generazione: è una scelta, non una
  correzione.
- **P2-09, HTML monolitici con definizioni sovrapposte**: è la causa prima delle
  due trappole descritte all'inizio. Non si chiude con una correzione ma con una
  build, ed è un lavoro a sé. Nel frattempo la regola resta: **cercare l'ultima
  definizione, e provarla chiamandola.**
- **P3-02, gli export XLSX sono istantanee senza formule**: da dichiarare nella
  UI e nei nomi dei file.
- **Matrice sui dispositivi fisici**: Chromium headless non ha safe area, quindi
  l'E2E misura i 12/16px di fallback. iPhone e Android vanno provati a mano.


## Confronto regimi — audit del 22 agosto e rinomina

Il tool era uscito come «Convenienza fiscale». Il nome non diceva cosa fa, e
Riccardo lo ha cambiato in **Confronto regimi** (sottotitolo «Forfettario,
ordinario, STP/STA»). Rinominato anche l'indirizzo: `/tools/confronto-regimi/`,
con un rimando `noindex` da `/tools/convenienza-fiscale/`. Il tool era pubblico
da poche ore, quindi allinearlo ora è costato un rimando; farlo dopo sarebbe
costato un rimando per sempre.

**I tre difetti gravi dell'import, tutti miei.**

- L'import partiva da `Object.assign(cfStatoDefault(), clone(cfStato()))`: un
  file che non conteneva un campo lasciava dentro il valore della simulazione
  precedente. Provato — dopo la demo, un file con solo «Compensi = 50.000»
  conservava compenso amministratore 40.000, altri redditi 15.000 e
  distribuzione al 70%. Ora si parte da stato pulito, l'unione con la
  simulazione corrente è una scelta esplicita in una finestra, e i campi
  assenti dal file vengono elencati.
- Il filtro anti-demo usava un'impronta «nome + importo». Nel commento avevo
  scritto che l'impronta completa evitava i falsi positivi: **era falso**. I
  nomi delle voci vengono da un elenco fisso, quindi ogni utente ha una riga
  «Affitto o coworking» e a distinguerla restava il solo importo: un affitto
  vero da 14.000 veniva escluso in silenzio. L'impronta è stata rimossa. Il
  presidio resta il nome del foglio (`ESEMPI_NON_IMPORTARE`), che non ha falsi
  positivi possibili. **In F24 l'impronta resta** e va tenuta: là è la riga
  intera — denominazione, codice fiscale, partita IVA, sezione, codice tributo,
  anno e i due importi — e quella combinazione su un cliente vero è impossibile.
- I valori non validi diventavano default plausibili: «commercialsta» scritto
  male diventava «commercialista». Ora le enumerazioni sono chiuse, i negativi
  e le percentuali fuori intervallo bloccano, l'anno si valida prima di caricare
  i parametri, e l'errore dice quale cella correggere. Un foglio **assente** non
  blocca: un file parziale deve funzionare.

**La barra di sessione era nel layer condiviso.** `tal-app.css` la metteva a
`top:0` con z-index 40, sotto un'intestazione sticky a z-index 5000: scorrendo
finiva dietro. Riguardava LIPE, F24 e Confronto regimi. Il Fascicolo era
l'unico giusto perché aveva un `top:104px` locale, cioè aveva corretto il
sintomo per sé. Ora il `top` viene da `--tal-global-header-height`, che
`tal-app.js` misura per tutti e sei, e i tre `top` locali del Fascicolo sono
stati rimossi. La barra scura del Fascicolo **non è stata toccata**: la regola
condivisa imposta solo il `top`.

**Nero su nero nelle riclassificazioni.** `tal-app.css` aveva
`html.tal-tool-page td{color:var(--tal-fg) !important}`. Un `!important` a
specificità (0,1,2) batte `.xr-grand td{color:#fff!important}` che sta a
(0,1,1), quindi le righe dei totali — fondo scuro e testo bianco per
costruzione — si ritrovavano #0b0b0b su #0b0b0b: **rapporto di contrasto 1,0**.
Ora il colore ha specificità (0,2,2) e nessun `!important`, così le regole
scritte di proposito per abbinare fondo e testo vincono. È l'inverso della
trappola già annotata sulla barra del Fascicolo: là schiarire tutto produceva
bianco su bianco, qui scurire tutto produceva nero su nero.

**`tests/contrast-harness.html`** è nata da qui: nessun controllo guardava il
contrasto. Attenzione, al primo giro segnalava 90 problemi e 88 erano falsi
positivi — intestazione e sidebar hanno fondo a **gradiente**, e
`backgroundColor` non lo vede, quindi attribuiva al testo il fondo della pagina.
Ora se incontra un gradiente dichiara «non misurabile» invece di dare un numero
sbagliato: quei 310 elementi restano da guardare a occhio.

**Rilievi dell'audit che non ho applicato, e perché.**

- **Badge «Beta sperimentale» in ogni schermata**: contraddice la decisione del
  14 agosto, che ha rimosso la striscia «Strumento sperimentale» da Fascicolo e
  LIPE. Lo stato di maturità sta nel catalogo, dove chi scegle lo vede prima di
  aprire.
- **Skip link «assente»**: ce n'è uno per tool, misurato. Il rilievo è vecchio.
- **«Il settimo tool»**: sono sei.
- **Nascondere il break-even verso il forfettario non disponibile**: quel
  controfattuale è una richiesta esplicita del brief. Il difetto era la cornice,
  non la funzione: ora dice «Ipotesi: se ti fossi fermato a 85.000… quella
  strada non c'è più».
- **SheetJS estratto e caricato in differita** e **CSP**: refactor che toccano
  tutti e sei i tool. Decisione di Riccardo: non adesso.

**La pagina Strumenti ha tre famiglie.** Contabilità e bilancio, Fiscale e
adempimenti, Organizzazione e decisioni. Un colore per famiglia, ripetuto nel
tag di ogni card, con il testo sempre presente accanto: il colore non è mai la
sola informazione. I tag hanno rapporti di contrasto fra 6,95 e 11,83.

**`--tal-ink-4` (#AAA7A0) non è un colore da testo**: dà 2,40 su bianco, sotto
la soglia di 3,0 del testo grande. In Confronto regimi era usato per tutte le
etichette piccole ed è stato sostituito con `--tal-ink-3` (5,31). Il token
**resta definito** e usato altrove: cambiarlo tocca sei tool e ventinove pagine
editoriali, quindi è un punto aperto, non una correzione fatta.

**Aperto su questo tool.** Lo screenshot della sequenza di caricamento in
«Configura con AI» (la scheda 07 c'è, la figura no). Il PDF del confronto. Il
profilo previdenziale con neo-iscritti, under 35 e riduzioni. Le regole dei
costi separate fra professionista e società, con plafond e ammortamento. Le
detrazioni IRPEF per categoria invece che per natura prevalente — oggi
l'approssimazione è dichiarata fra le verifiche.


## Confronto regimi 1.1.0 — il re-audit del 22 agosto 2026

Secondo audit esterno sullo stesso tool, eseguito dopo le correzioni del
mattino. Verificato rilievo per rilievo contro il codice vivo: uno era già
chiuso, uno non si riproduce, gli altri erano veri.

### Il difetto bloccante, e perché era invisibile

`const tot = totaliCosti(cfNum(input.costFactor, 0, 100) || 1);`

In JavaScript `0 || 1` fa 1. Il fattore di costo zero — «e se non avessi
nessun costo?» — diventava «con i costi di adesso». La soglia di pareggio dei
costi apre esattamente con quella domanda: `if (delta(0) >= 0) sogliaCosti = 0`
confrontava i due regimi al livello di costo corrente e, trovando l'ordinario
già avanti, concludeva che pareggia a costo zero senza cercare nulla. Nel caso
dimostrativo a 90.001 la pagina diceva **€0** dove il pareggio vero è
**€52.334,66**, e il valore finiva anche nell'Excel.

Riprodotto prima di correggere, in sandbox: `f=0` e `f=1` restituivano
entrambi 52.868 € di costi, mentre `f=1e-12` restituiva zero. È la firma del
fallback che mangia lo zero.

La correzione distingue «parametro assente» da «parametro uguale a zero», che
con `||` non è possibile:

```js
const dichiarato = input.costFactor != null && input.costFactor !== '';
const fattoreChiesto = dichiarato ? Number(input.costFactor) : NaN;
const costFactor = Number.isFinite(fattoreChiesto) ? cfNum(fattoreChiesto, 0, 100) : 1;
```

Il secondo `!= null` non c'era nella prima stesura, e il test che avevo scritto
per la correzione l'ha bocciata: `Number(null)` fa **0**, non NaN, quindi un
fattore nullo veniva letto come «zero costi». Lo stesso genere di scorciatoia
del difetto originale, in direzione opposta.

### Gli altri rilievi veri

- **«Annulla» avviava il merge.** `unisci = !confirm(...)`: il dialogo nativo ha
  due risposte e ne servivano tre. Chi premeva Esc per non procedere aggiornava
  la simulazione in corso. Ora c'è una finestra vera con tre pulsanti, il fuoco
  intrappolato, Esc che annulla, e — prima di scegliere — il riepilogo di cosa
  contiene il file: quanti campi, quali mancano, quante voci nuove, quanti campi
  verrebbero sovrascritti. Quest'ultimo conteggio guarda solo le chiavi
  effettivamente lette dal file: confrontando tutto lo stato diceva dodici dove
  i campi nel file erano otto.
- **Il compenso amministratore veniva ridotto in silenzio.** `Math.min(chiesto,
  massimo)`: chiesti 40.000, usati 35.920,60. Ora l'esito porta
  `compensoRichiesto` e `compensoRidotto`, la pagina mostra un riquadro con i
  tre importi distinti, e l'Excel li tiene separati.
- **Gli input a mano non avevano validazione.** `leggiNumero` trasforma
  qualunque cosa in un numero e in ultima istanza in zero: «90.00O» con la O
  maiuscola diventava zero. Ora c'è `valida()`, uno schema solo usato da form,
  import, archivio ed export: `aria-invalid` sul campo, messaggio collegato con
  `aria-describedby`, riepilogo con `role="alert"` che prende il fuoco, e il
  risultato che **non compare** finché un dato non torna. Il fuoco va dato dopo
  quello che `vaiA()` mette su `#cfMain`, altrimenti lo perde.
- **Mancava l'eccezione del rapporto di lavoro cessato.** La soglia dei 35.000
  sui redditi da lavoro dipendente dell'anno precedente non opera se quel
  rapporto è cessato — ma l'eccezione cade se nell'anno arrivano redditi da un
  nuovo rapporto o da pensione, altrimenti basterebbe cambiare datore. Campo
  nuovo, deroga condizionata a entrambe le cose, e dichiarata nell'esito.
- **Le regole salvate sovrascrivevano i default nuovi.** Il commento diceva che
  si riallineano; `Object.assign({}, base, salvato)` con un record che porta
  tutti i campi della regola faceva l'opposto. Ora si salvano gli importi e i
  soli scostamenti, con la versione del ruleset: al ritorno, se è cambiata,
  l'utente lo sa. I salvataggi in formato 1 vengono conservati come modifiche
  manuali, con un avviso che invita a ripristinare i default.
- **L'Excel non era ripercorribile.** Il foglio dei costi era un elenco di
  importi: nessun modo di capire perché il totale deducibile differisse dal
  costo di cassa. Ora ogni riga porta venti colonne — aliquote, uso
  professionale, tetto in euro, se il tetto ha morso, importi dedotti per IRPEF,
  IRES e IRAP, origine della regola — e c'è un foglio «Assunzioni e controlli»
  con severità e stato. Gli importi dedotti per riga li calcola il motore, non
  l'esportatore: ricalcolarli lì avrebbe creato una seconda verità.
- **Le assunzioni erano due elenchi.** Uno scritto a mano in `renderVerifiche()`
  e uno nell'Excel, e divergevano: il working paper non portava né il compenso
  ridotto né la maternità non determinata, cioè le due voci che spostano il
  risultato. Ora c'è `cfAssunzioni()` nel motore, letto da entrambi.

### Il regime attuale, che era obbligatorio e non serviva a niente

`currentRegime` compariva nello stato, nel gate, nelle etichette e
nell'import/export, e non entrava in nessun calcolo. Il testo di «Configura con
AI» prometteva che decide quali soglie contano: non è vero, le soglie valgono
per tutti gli scenari.

Scelta: resta obbligatorio e diventa il punto di partenza dichiarato. Il
verdetto dice la differenza rispetto a lui, la sua card è marcata come baseline,
le altre due misurano la distanza, e sotto compare cosa comporta il passaggio —
notaio, iscrizione all'albo, IVA a cavallo, rettifica della detrazione. Il copy
che prometteva il contrario è stato corretto nella pagina e nel prompt.

### Cosa non era vero, e cosa era già chiuso

- **Cloudflare Insights**: l'audit dice che il tool lo carica e che la frase «I
  dati non vengono inviati» va ammorbidita. Misurato in produzione: **zero**
  risorse fuori origine, nessuno script beacon. La frase resta com'è.
- **Il disclaimer LIPE nel footer**: già corretto la mattina dello stesso
  giorno, prima che l'audit venisse eseguito.
- **Il minimo integrativo di Cassa Forense** era dichiarato «non confermato da
  fonte citabile». La fonte c'è: la pagina dei contributi minimi obbligatori
  espone 355,00 € per il 2026, e — dato che l'audit non riportava — li dimezza
  entrambi (1.395 e 177,50) per chi si è iscritto prima dei 35 anni, nei primi
  sei anni. Implementato per Cassa Forense; per CNPADC non ho trovato gli
  importi ridotti in una fonte citabile, quindi la riduzione non è applicata ed
  è dichiarata fra le assunzioni.

### Cosa serve fare fuori dal repository

**Redirect 301 del vecchio URL.** `/tools/convenienza-fiscale/` risponde HTTP
200 con una pagina di rinomina che reindirizza via JavaScript. GitHub Pages non
può emettere un 301 su un percorso: serve una regola su Cloudflare.

In *Rules → Redirect Rules → Create rule*:

- **Nome**: `convenienza-fiscale to confronto-regimi`
- **Quando**: `URI Path` `equals` `/tools/convenienza-fiscale/`
  (per coprire anche la forma senza slash finale: espressione personalizzata
  `starts_with(http.request.uri.path, "/tools/convenienza-fiscale")`)
- **Allora**: *Static redirect* → `https://taxautomationlab.com/tools/confronto-regimi/`
- **Stato**: `301` permanente, *Preserve query string* attivo

La pagina attuale può restare: con la regola attiva non viene più raggiunta, e
se la regola viene rimossa il reindirizzamento JavaScript continua a funzionare.

### Rimasto aperto per scelta

CSP e HSTS più lungo (richiedono il pannello Cloudflare e convivono male con gli
script inline), SheetJS incorporato, regole analitiche per auto, beni
pluriennali, vitto e alloggio, e detrazioni IRPEF per categoria invece che per
categoria prevalente. Tutte dichiarate a schermo e nel working paper.

### Verifica

68 test node (14 nuovi: la matrice di regressione del §13 del report), 42
controlli responsive — con il controllo nuovo sull'hamburger del sito, che era
la voce più vecchia rimasta aperta nel contesto — zero problemi di contrasto con
la misura composta, e gli elementi nuovi misurati a mano fra 4,99 e 19,68.

## Aperto

- **LIPE**: far passare un file generato nel **software di controllo dell'Agenzia
  delle Entrate**. È gratuito, è la verifica definitiva, e chiarirebbe anche se
  `IdentificativoProdSoftware` sia davvero omissibile: la struttura è allineata a
  una fornitura accettata, ma il confronto con un file non sostituisce il
  validatore.
- **XBRL**: validare un'istanza con lo strumento del Registro delle imprese, e
  confrontare lo schema **ordinario** con un'istanza ordinaria reale (l'unico
  punto ancora dedotto).
- **Nota integrativa nell'XBRL**: i blocchi `Introduzione*`/`Commento*` e
  `DichiarazioneConformita` servono per un fascicolo completo.
- **Ripartizione entro/oltre esercizio** per singola controparte nello schema
  ordinario: serve per un XBRL ordinario pienamente analitico.
- **Nota integrativa e rendiconto finanziario**: fuori perimetro oggi.
- **Concept condiviso**: resta **LIPE** — gruppo «Risultati e dati» completo
  (mancano Dati e backup e Come si usa) e deep link. Vedi la tabella sopra.
- **Foglio «Esiti AI» negli altri tool**: il Bilancio ora lo importa e lo
  trasforma in eccezioni da chiudere prima dell'export. Analisi, LIPE, F24 e
  Fascicolo hanno lo stesso foglio nel template di «Configura con AI» e lo
  ignorano ancora. È una decisione di concept, quindi va replicata.
- **Gate di export unico negli altri tool**: stesso discorso. Nel Bilancio è
  `window.fsExportGate` e da lì passano tutti e quattro gli export.
- **PDF uniformi**: i report di `financial-analysis` passano da `window.open` e
  dalla stampa del browser, il Bilancio scarica con jsPDF. Da decidere quale dei
  due è il comportamento canonico, poi uniformare.
- **Indirizzi delle sezioni** (deep link) negli altri tre tool: il Fascicolo li
  ha (`#/profilo/tax`), il Bilancio ora anche, gli altri due no.
- **Stato «Non salvato»** della barra comandi: il ramo di codice esiste ma non è
  stato possibile provarlo (non si riesce a esaurire la quota del browser).
- **F24, file telematico**: farlo passare dal **modulo di controllo F24A0
  dell'Agenzia**. È il gate di rilascio della funzione: finché non è fatto la
  generazione resta dietro la conferma esplicita. Stessa natura del punto aperto
  su LIPE, e converrebbe farli nello stesso giro.
- **F24, codici tributo**: l'elenco incorporato è di riferimento e non
  esaustivo, con INPS e INAIL volutamente più stretti dell'Erario. Un codice
  fuori elenco produce un avviso, non un blocco, e l'utente può aggiungerlo.
  Vale la pena allargarlo con un elenco ufficiale, non a memoria.
- **Traduzioni dei tool** in inglese e spagnolo, quando smetteranno di cambiare.
- **Etichetta di release della suite**: per ora ogni tool tiene il suo numero
  reale, senza numerazione unica.
- L'animazione WebGL della landing usa ancora fucsia e magenta puri
  (`#f967fb`, `#ff008a`): è il punto più viola rimasto.
