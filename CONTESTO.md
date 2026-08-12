# Contesto per la prossima sessione

Stato al 12 agosto 2026. Questo file serve a ripartire senza rileggere tutto.

## Cos'è questo repository

Sito statico pubblicato su GitHub Pages (`zeddariccardo/tax-automation-lab` →
taxautomationlab.com). Nessun build, nessuna dipendenza da installare: si apre
un file e si modifica. Per provarlo in locale:

```bash
python -m http.server 4173 --directory <cartella del repo>
```

**60 pagine HTML**: 56 editoriali (italiano, inglese, spagnolo) e 4 applicazioni.

## I due layer di stile

Tutto lo stile passa da due file condivisi, agganciati in fondo al `<head>`.
Sono mutuamente esclusivi e non possono contaminarsi:

| File | Si applica a | Aggancio |
|---|---|---|
| `assets/tal-design.css` | 56 pagine editoriali | `html:not(.tal-tool-page)` |
| `assets/tal-experience.js` | idem | sfondo animato, comparsa allo scroll |
| `assets/tal-app.css` | 4 applicazioni | `html.tal-tool-page` |
| `assets/tal-app.js` | idem | barra comandi condivisa |

Gli indirizzi portano `?v=20260812`: **va incrementato a ogni modifica dei
fogli**, altrimenti i browser di chi ha già visitato il sito servono la versione
vecchia.

Documentazione di dettaglio: `assets/tal-design.README.md`.

## Le regole di stile che valgono ovunque

- **Font**: Inter e Newsreader, self-hosted in `assets/fonts/`. Nessuna chiamata
  esterna: il sito dichiara che non raccoglie dati e deve restare vero.
- **Sfondo editoriale**: petrolio ≈76%, viola ≈23%, ruggine come accento. Il
  viola era al 47% e schiacciava tutto: non riportarlo su.
- **Accento unico dei tool**: petrolio `#145368`. Niente lime, niente blu, niente
  viola: erano tre accenti diversi in quattro tool.
- **Verde = aggiungi, arancio = modifica** (`.btn.add`, `.btn.edit`).
- **Sidebar dei tool**: petrolio, stato attivo in pastiglia bianca.
- Tutto il movimento rispetta `prefers-reduced-motion`.

## I quattro tool

`/tools/financial-statement/` · `/tools/financial-analysis/` · `/tools/lipe/` ·
`/tools/tfa-client-file/`

Sono **solo in italiano**. Le pagine `/en/tools/<slug>/` e `/es/tools/<slug>/`
sono pagine di avviso in `noindex` che spiegano perché e rimandano alla versione
italiana. Scelta deliberata: mantenere tre copie tradotte di applicazioni che
cambiano ogni settimana significa correggere una lingua e lasciare indietro le
altre due.

Struttura comune della sidebar, uguale nei quattro:

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

Versioni reali (allineate ovunque, anche nei dati strutturati):
`1.4.0` Bilancio civilistico · `2.1.0` Analisi di bilancio · `2.3.2` Fascicolo
cliente · `3.4.1→3.4.3` LIPE.

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
- **PDF uniformi**: i report di `financial-analysis` passano da `window.open` e
  dalla stampa del browser, il Bilancio scarica con jsPDF. Da decidere quale dei
  due è il comportamento canonico, poi uniformare.
- **Indirizzi delle sezioni** (deep link) negli altri tre tool: il Fascicolo li
  ha (`#/profilo/tax`), il Bilancio ora anche, gli altri due no.
- **Stato «Non salvato»** della barra comandi: il ramo di codice esiste ma non è
  stato possibile provarlo (non si riesce a esaurire la quota del browser).
- **Traduzioni dei tool** in inglese e spagnolo, quando smetteranno di cambiare.
- **Etichetta di release della suite**: per ora ogni tool tiene il suo numero
  reale, senza numerazione unica.
- L'animazione WebGL della landing usa ancora fucsia e magenta puri
  (`#f967fb`, `#ff008a`): è il punto più viola rimasto.
