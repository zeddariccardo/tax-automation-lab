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

Versioni reali (allineate ovunque, anche nei dati strutturati):
`1.3.6` Bilancio civilistico · `2.0.6` Analisi di bilancio · `2.3.2` Fascicolo
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

## Aperto

- **Indirizzi delle sezioni** (deep link) negli altri tre tool: il Fascicolo li
  ha (`#/profilo/tax`), gli altri no, quindi il tasto Indietro esce dal tool.
- **Stato «Non salvato»** della barra comandi: il ramo di codice esiste ma non è
  stato possibile provarlo (non si riesce a esaurire la quota del browser).
- **Traduzioni dei tool** in inglese e spagnolo, quando smetteranno di cambiare.
- **Etichetta di release della suite**: per ora ogni tool tiene il suo numero
  reale, senza numerazione unica.
- L'animazione WebGL della landing usa ancora fucsia e magenta puri
  (`#f967fb`, `#ff008a`): è il punto più viola rimasto.
