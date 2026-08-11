# Layer estetico condiviso (v7.1)

Quattro file, nessuna dipendenza esterna, nessuna modifica alla logica delle pagine.

| File | Ruolo |
|---|---|
| `assets/fonts/` + `fonts.css` | Inter e Newsreader variabili, self-hosted (OFL). Nessuna chiamata a Google. |
| `assets/tal-design.css` | Pagine editoriali: tipografia, contenitori, superfici, sfondo, movimento. |
| `assets/tal-experience.js` | Sfondo animato (masse di colore + fasci luminosi), stato dell'header allo scroll, comparsa dei blocchi, barra di avanzamento. |
| `assets/tal-app.css` | Le quattro applicazioni: token, controlli, tabelle, sidebar, stati. |
| `assets/tal-app.js` | Applicazioni: trasforma l'avviso d'uso in una striscia richiudibile. |

I due layer sono mutuamente esclusivi: `tal-design.css` è agganciato a
`html:not(.tal-tool-page)`, `tal-app.css` a `html.tal-tool-page`.

## Tavolozza

Editoriale (fondo scuro): il petrolio guida il quadro (≈76%), il viola resta
tonalità d'apertura (≈23%), il ruggine è riservato agli accenti. Il confronto
fra le proporzioni è in `_anteprima-sfondi.html` (file temporaneo, da cancellare
prima della pubblicazione).

Sopra alle masse di colore corrono sei **fasci luminosi** in SVG, ispirati ai
tubi della schermata d'ingresso ma disegnati senza WebGL e senza librerie
esterne: ogni filo è tracciato tre volte — alone, corpo, nucleo — così il
bagliore nasce dalla geometria e non da un filtro di sfocatura, che a tutto
schermo costerebbe un ridisegno per fotogramma. Si muovono in tre gruppi con
periodi diversi (52s, 68s, 44s), animando solo `transform`.

Applicazioni (fondo carta): un solo accento, il petrolio `#145368`, usato per
focus, voce attiva, filo dei titoli e intestazioni di tabella. Le variabili
`--tal-purple` e `--tal-purple-2`, usate dai tool per sidebar e monogrammi,
sono ridefinite sul petrolio in `tal-app.css`: cambiare quelle due righe
ricolora tutti i componenti che le usano.

## Come è agganciato

In fondo al `<head>` di ogni pagina pubblica (48 file):

```html
<link rel="preload" as="font" type="font/woff2" href="/assets/fonts/inter-var-latin.woff2" crossorigin>
<link rel="preload" as="font" type="font/woff2" href="/assets/fonts/newsreader-var-latin.woff2" crossorigin>
<link rel="stylesheet" href="/assets/tal-design.css">
<script defer src="/assets/tal-experience.js"></script>
```

Nelle dodici pagine applicative (`/tools/*`, `/en/tools/*`, `/es/tools/*`) il blocco è invece:

```html
<link rel="preload" as="font" type="font/woff2" href="/assets/fonts/inter-var-latin.woff2" crossorigin>
<link rel="stylesheet" href="/assets/tal-app.css">
<script defer src="/assets/tal-app.js"></script>
```

Le quattro applicazioni **non** hanno il blocco editoriale.

## Due scelte da conoscere prima di modificare i tool

1. **La banda nera in fondo (`footer.foot`) è nascosta**, non cancellata: il
   markup e il testo restano nel file. Portava un disclaimer specifico per
   tool; la formulazione generale — elaborazione locale e verifica da parte
   del professionista — resta nel piè di pagina del sito, presente su tutte le
   pagine. Per rimetterla: cancellare la riga `footer.foot{display:none}`.
2. **L'avviso d'uso (`#tal-tool-safety`) è nascosto**, non cancellato. Era
   presente solo in LIPE e Fascicolo fiscale. Per rimetterlo: cancellare la
   regola `#tal-tool-safety{display:none}`.
3. **Il pulsante flottante del menu** (`.sb-toggle`) sotto i 980px è ridotto a
   un quadrato di 44px: da pillola larga copriva il testo delle schede mentre
   la pagina scorre. L'etichetta resta nel DOM, quindi il nome accessibile non
   cambia.
In più ogni regola è scritta come `html:not(.tal-tool-page) …`: anche se il file venisse
incluso per errore in un tool, non avrebbe effetto.

Per tornare indietro basta togliere le quattro righe: le pagine restano quelle di prima.

## Regole da rispettare quando si aggiungono pagine

1. Copiare il blocco qui sopra prima di `</head>`.
2. Usare i contenitori esistenti (`.wrap` o `.shell`, `main`): la gronda si applica da sola
   una volta sola, anche se i contenitori sono annidati (variabile `--tal-pad`).
3. Usare i nomi già in uso — `.hero`, `.lead`, `.eyebrow`/`.label`, `.card`, `.panel`,
   `.button`, `.button.secondary` — invece di scrivere nuovi stili: la scala tipografica
   e le superfici sono già definite per quei nomi.
4. Non serve dichiarare font, dimensioni dei titoli, padding delle card o colori del testo.

## Cosa resta fuori dal layer

- Le quattro applicazioni.
- L'easter egg di Romeo (`.rg-modal` e classi `rg-*`): escluso esplicitamente dalle regole
  tipografiche globali, mantiene carta, inchiostro e font suoi.
- La schermata di ingresso WebGL della home: invariata, solo tipografia allineata.

## Movimento

Tutto il movimento è sospeso con `prefers-reduced-motion: reduce`.
La comparsa allo scroll ha una rete di sicurezza: se dopo 2,6 secondi nessun blocco è
comparso (IntersectionObserver non disponibile, scheda in secondo piano), l'effetto viene
disattivato e il contenuto torna visibile.
