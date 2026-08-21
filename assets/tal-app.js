/* Tax Automation Lab — strato condiviso delle applicazioni (v2.0)
   ---------------------------------------------------------------------------
   Quattro compiti, tutti nati da difetti visti usando i tool e non leggendoli:

   1. UNA barra di sessione, non due. Tre tool su cinque scrivevano il nome
      della società due volte sullo stesso schermo: nella sidebar e di nuovo
      nella barra sotto la «Sessione di lavoro». Il contesto resta nel DOM —
      i tool ci scrivono dentro e non voglio rompere quelle scritture — ma
      sparisce dallo schermo, e la barra tiene solo etichetta, comandi e stato
      del salvataggio.

   2. «Informazioni sullo strumento» sta in «Come si usa». Era in cima a ogni
      schermata di ogni tool: tre righe di presentazione davanti a chi sta già
      lavorando.

   3. Il colore dice cosa fa il pulsante. Verde aggiunge, arancio modifica —
      era già la regola del Fascicolo cliente, ma solo il Fascicolo e F24 la
      applicavano. Il terzo caso, il salvataggio, non esisteva: qui è viola
      sfumato in petrolio. La classificazione è per etichetta e vale anche sui
      pulsanti creati a runtime, che negli altri tool sono la maggioranza.

   4. «Configura con AI» apre una scheda nuova. Portava via la sessione di
      lavoro in corso da un collegamento che sembra una voce di menu.

   Lo stato del salvataggio resta osservato sulla scrittura vera
   (Storage.prototype.setItem): un indicatore «Salvato» che si accende senza
   che nulla sia stato scritto è peggio che non averlo. */
/* ---------------------------------------------------------------------------
   Foglio «Esiti AI» — lettore condiviso.

   Il foglio esiste nel template di «Configura con AI» di tutti e cinque i
   tool, ed è il posto dove l'AI scrive dubbi, assunzioni e fonti. Il Bilancio
   civilistico lo importava e lo trasformava in eccezioni da chiudere; Analisi,
   LIPE, Fascicolo e F24 lo ignoravano. Risultato: i dati passavano e proprio
   l'avviso che dovrebbe fermare una decisione incerta si perdeva. È il rilievo
   TAL-P1-02 dell'audit del 21 agosto 2026.

   Sta qui, e non dentro i tool, perché è la stessa lettura per tutti: una sola
   definizione, così non divergono come è già successo col menu mobile. Non
   tocca il DOM ed è definito prima della guardia `tal-tool-page`, quindi è
   disponibile anche a chi carica questo file fuori da una pagina applicativa
   (per esempio i test). */
(function () {
  'use strict';

  /* Confronto tollerante: accenti, maiuscole, spazi doppi e spazi non
     separabili non devono far mancare una colonna. Lo spazio unificatore
     U+00A0 arriva davvero, incollato dentro Excel. */
  function norm(s) {
    var t = String(s == null ? '' : s).replace(/ /g, ' ');
    if (t.normalize) t = t.normalize('NFD').replace(/[̀-ͯ]/g, '');
    return t.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  /* Uno stato conta come chiuso solo se lo dice. Il default è aperto: un
     campo vuoto è un dubbio non risolto, non un dubbio che non c'è. */
  function isClosed(stato) {
    return /^(risolt|chius|verificat|ok\b|superat|confermat)/.test(norm(stato));
  }

  /* «Bloccante» è una parola che l'AI può scrivere nello stato o nel tipo:
     quando c'è, l'elaborazione non deve proseguire finché non è chiusa. */
  function isBlocking(row) {
    var s = norm(row.stato) + ' ' + norm(row.tipo);
    return /blocc|critic|impedisc/.test(s);
  }

  /* Trova il foglio per nome, tollerando accenti, spazi e maiuscole. */
  function findSheet(wb, wanted) {
    if (!wb || !wb.SheetNames) return null;
    var target = norm(wanted);
    for (var i = 0; i < wb.SheetNames.length; i++) {
      if (norm(wb.SheetNames[i]) === target) return wb.SheetNames[i];
    }
    for (var j = 0; j < wb.SheetNames.length; j++) {
      if (norm(wb.SheetNames[j]).indexOf(target) >= 0) return wb.SheetNames[j];
    }
    return null;
  }

  /* Legge il foglio e restituisce le eccezioni. `XLSX` arriva dal chiamante:
     questo file non dipende dalla libreria e non la carica. */
  function read(wb, XLSX, sheetName) {
    if (!wb || !XLSX) return [];
    var name = findSheet(wb, sheetName || 'Esiti AI');
    if (!name) return [];
    var data = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: '' });
    var head = -1;
    for (var r = 0; r < Math.min(data.length, 15); r++) {
      var row = (data[r] || []).map(function (x) { return norm(x); });
      if (row.indexOf('elemento da verificare') >= 0) { head = r; break; }
    }
    if (head < 0) return [];
    var H = (data[head] || []).map(function (x) { return norm(x); });
    /* Le intestazioni del template sono composte («Codice conto / campo»,
       «Osservazione / assunzione»): serve il prefisso, non l'uguaglianza. */
    var ix = function (label) {
      var k = norm(label);
      for (var i = 0; i < H.length; i++) { if (H[i].indexOf(k) === 0) return i; }
      return -1;
    };
    var iTipo = ix('tipo'), iEl = ix('elemento da verificare'), iSt = ix('stato'),
        iOss = ix('osservazione'), iFonte = ix('fonte');
    /* La colonna di riferimento si chiama diversamente in ogni tool: «Codice
       conto / campo» nel Bilancio, «Codice IVA / campo» in LIPE. */
    var iRif = ix('codice');
    var out = [];
    for (var i2 = head + 1; i2 < data.length; i2++) {
      var rw = data[i2] || [];
      var g = function (j) { return j >= 0 ? String(rw[j] == null ? '' : rw[j]).trim() : ''; };
      var elemento = g(iEl);
      if (!elemento) continue;
      var tipo = g(iTipo);
      /* La riga di esempio del template non è un'eccezione vera. */
      if (norm(tipo) === 'esempio' || /non lasciare questa riga/i.test(elemento)) continue;
      var item = {
        tipo: tipo, rif: g(iRif), elemento: elemento, stato: g(iSt),
        osservazione: g(iOss), fonte: g(iFonte), sourceRow: i2 + 1
      };
      item.closed = isClosed(item.stato);
      item.blocking = !item.closed && isBlocking(item);
      out.push(item);
    }
    return out;
  }

  function summarize(findings) {
    var list = findings || [];
    var open = list.filter(function (f) { return !f.closed; });
    return {
      total: list.length,
      open: open.length,
      closed: list.length - open.length,
      blocking: open.filter(function (f) { return f.blocking; }).length
    };
  }

  /* Righe pronte per il foglio «Esiti AI» di un export: le eccezioni
     sopravvivono al giro completo import → lavoro → export. */
  function toSheetRows(findings) {
    var head = ['Tipo', 'Codice / campo', 'Elemento da verificare', 'Stato',
                'Osservazione / assunzione', 'Fonte utilizzata'];
    return [head].concat((findings || []).map(function (f) {
      return [f.tipo || '', f.rif || '', f.elemento || '', f.stato || '',
              f.osservazione || '', f.fonte || ''];
    }));
  }

  window.TAL_AI = { read: read, summarize: summarize, toSheetRows: toSheetRows,
                    isClosed: isClosed, findSheet: findSheet };
})();

/* ---------------------------------------------------------------------------
   Limiti di caricamento — contratto condiviso.

   Prima ogni tool decideva i suoi: Analisi 15 MB, LIPE 25 MB, il Fascicolo 12
   per gli XLSX e 6 per le immagini, F24 5, e il Bilancio civilistico **nessun
   limite**. Su un file grande la lettura di SheetJS blocca il thread
   principale: su iPhone la scheda muore senza dire perché. È il rilievo
   TAL-P1-08 dell'audit del 21 agosto 2026.

   I numeri sono volutamente generosi — un bilancio vero non arriva a 15 MB —
   perché servono a fermare l'incidente (il file sbagliato, l'export di un ERP
   intero), non a limitare l'uso. Il Fascicolo tiene soglie più strette sui
   propri allegati e immagini: sono più severe di queste, quindi restano.

   `check()` va chiamato **prima** di leggere il file, e restituisce null se va
   bene o un messaggio pronto da mostrare. Il messaggio dice sempre il limite e
   la dimensione vera: «troppo grande» da solo non aiuta nessuno. */
(function () {
  'use strict';
  var MB = 1024 * 1024;

  var LIMITS = {
    xlsxBytes:     15 * MB,   // foglio di calcolo in ingresso
    jsonBytes:     25 * MB,   // backup e archivi
    imageBytes:     6 * MB,   // allegati immagine
    rowsPerSheet:   25000,
    sheetsPerFile:  40,
    cellsPerFile:   400000
  };

  function human(bytes) {
    if (bytes >= MB) return (bytes / MB).toFixed(bytes >= 10 * MB ? 0 : 1).replace('.', ',') + ' MB';
    return Math.max(1, Math.round(bytes / 1024)) + ' KB';
  }

  /* kind: 'xlsx' | 'json' | 'image'. Estensioni accettate per ciascuno, così
     il messaggio sul formato sbagliato è uno solo per tutta la suite. */
  var KINDS = {
    xlsx:  { bytes: 'xlsxBytes',  re: /\.(xlsx|xls)$/i,          what: 'un file .xlsx o .xls' },
    json:  { bytes: 'jsonBytes',  re: /\.json$/i,                what: 'un file .json' },
    image: { bytes: 'imageBytes', re: /\.(png|jpe?g|webp|gif)$/i, what: 'un’immagine PNG, JPG o WEBP' }
  };

  function check(file, kind) {
    var k = KINDS[kind] || KINDS.xlsx;
    if (!file) return 'Nessun file selezionato.';
    if (!k.re.test(file.name || '')) {
      return 'Formato non supportato: serve ' + k.what + '.';
    }
    var max = LIMITS[k.bytes];
    if (typeof file.size === 'number' && file.size > max) {
      return 'Il file pesa ' + human(file.size) + ' e il limite è ' + human(max)
           + '. Un file così grande blocca il browser durante la lettura: '
           + 'esporta solo i fogli che servono, oppure dividilo.';
    }
    return null;
  }

  /* Da mostrare accanto al controllo di caricamento: il limite dichiarato
     prima, non scoperto dopo il fallimento. */
  function describe(kind) {
    var k = KINDS[kind] || KINDS.xlsx;
    var s = 'Massimo ' + human(LIMITS[k.bytes]);
    if (kind === 'xlsx' || !kind) {
      s += ', ' + LIMITS.rowsPerSheet.toLocaleString('it-IT') + ' righe per foglio, '
         + LIMITS.sheetsPerFile + ' fogli';
    }
    return s + '.';
  }

  window.TAL_LIMITS = { values: LIMITS, check: check, describe: describe, human: human };
})();

(function () {
  'use strict';

  var root = document.documentElement;
  if (!root.classList.contains('tal-tool-page')) return;

  /* ---------------------------------------------------------------- 1. barra */

  /* I cinque tool chiamano la propria barra in cinque modi diversi. */
  var BAR_SELECTORS = '#tal-fs-commandbar,#tal-commandbar,.tal-fs-commandbar,.tal-commandbar,.cmdbar';

  function findBar() {
    return document.querySelector(BAR_SELECTORS);
  }

  function pillHtml(id) {
    return '<span class="save-pill tal-save-pill" id="' + id + '">Salvataggio automatico</span>';
  }

  /* I tre comandi di sessione sono gli stessi ovunque — Nuovo, Salva,
     Archivio, nell'ordine del Bilancio, che è il riferimento — ma dietro
     ognuno c'è la funzione del tool. Ogni tool li dichiara in
     `window.TAL_SESSION`; il valore può essere una funzione o il selettore di
     un comando che il tool ha già cablato altrove, così non si duplica
     logica che esiste. `hint` diventa il `title`: la parola è la stessa
     dappertutto, quello che fa cambia da tool a tool ed è giusto dirlo. */
  var ACTION_KEYS = [
    { key: 'onNew', label: 'Nuovo', cls: '' },
    { key: 'onSave', label: 'Salva', cls: 'primary' },
    { key: 'onArchive', label: 'Archivio', cls: '' }
  ];

  function runSessionAction(value) {
    if (typeof value === 'function') { value(); return; }
    if (typeof value === 'string') {
      var el = document.querySelector(value);
      if (el) el.click();
    }
  }

  function actionsEl() {
    var cfg = window.TAL_SESSION;
    if (!cfg) return null;
    var box = document.createElement('div');
    box.className = 'tal-session-actions';
    ACTION_KEYS.forEach(function (a) {
      if (!cfg[a.key]) return;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = a.cls;
      b.textContent = (cfg.labels && cfg.labels[a.key]) || a.label;
      var hint = cfg.hints && cfg.hints[a.key];
      if (hint) b.title = hint;
      b.addEventListener('click', function () { runSessionAction(cfg[a.key]); });
      box.appendChild(b);
    });
    return box.children.length ? box : null;
  }

  var HAS_ACTIONS = '.tal-session-actions,.tal-fs-commandactions,.tal-commandbar-actions';

  function buildBar() {
    var main = document.querySelector('.app-main') || document.body;
    var bar = findBar();

    if (bar) {
      bar.classList.add('tal-session-bar');
      /* L'etichetta ce l'hanno già Bilancio e Analisi dentro il proprio blocco
         di testo; al Fascicolo, a LIPE e a F24 va aggiunta. */
      if (!bar.querySelector('.tal-session-label') &&
          !bar.querySelector('.tal-fs-commandcopy,.tal-commandbar-copy')) {
        var lab = document.createElement('span');
        lab.className = 'tal-session-label';
        lab.textContent = 'Sessione di lavoro';
        bar.insertBefore(lab, bar.firstChild);
      }
      /* Il Fascicolo la barra ce l'aveva, ma senza i tre comandi: li aggiunge
         subito dopo l'etichetta, prima dei comandi propri del tool. */
      if (!bar.querySelector(HAS_ACTIONS)) {
        var acts = actionsEl();
        if (acts) {
          var label = bar.querySelector('.tal-session-label,.tal-fs-commandcopy,.tal-commandbar-copy');
          if (label) label.insertAdjacentElement('afterend', acts);
          else bar.insertBefore(acts, bar.firstChild);
        }
      }
      /* Niente distanziatore: la pastiglia si spinge a destra da sola con
         `margin-left:auto`. Un elemento elastico in mezzo, su telefono, si
         prendeva una riga tutta sua e la striscia andava a tre righe. */
      var pill = bar.querySelector('.save-pill,.tal-save-pill');
      if (!pill) bar.insertAdjacentHTML('beforeend', pillHtml('talSavePill'));
      /* Lo stato del salvataggio chiude la riga in tutti e cinque i tool: nel
         Fascicolo stava in mezzo ai comandi. */
      else if (pill !== bar.lastElementChild) bar.appendChild(pill);
      return bar;
    }

    /* Nessuna barra propria: se ne costruisce una, con etichetta, comandi e
       stato del salvataggio. Niente nome della società: è nella sidebar. */
    bar = document.createElement('div');
    bar.className = 'cmdbar tal-cmdbar tal-session-bar';
    bar.setAttribute('aria-label', 'Sessione di lavoro');
    bar.innerHTML = '<span class="tal-session-label">Sessione di lavoro</span>';
    var built = actionsEl();
    if (built) bar.appendChild(built);
    bar.insertAdjacentHTML('beforeend', pillHtml('talSavePill'));

    var header = main.querySelector('.tal-global-header');
    var anchor = main.querySelector('.tal-tool-safety') || header;
    if (anchor && anchor.parentNode === main) anchor.insertAdjacentElement('afterend', bar);
    else main.insertBefore(bar, main.firstChild);
    return bar;
  }

  /* Stato del salvataggio osservato sulla scrittura reale.
     Sostituire `localStorage.setItem` scriveva una chiave vera di nome
     «setItem» dentro l'archivio dell'utente, che finiva anche nei backup JSON.
     Il posto giusto è il prototipo. */
  function watchStorage() {
    var pill = document.querySelector('.save-pill,.tal-save-pill');
    if (!pill || !window.Storage || !window.localStorage) return;

    var native = Storage.prototype.setItem;
    if (native.__talWrapped) return;

    function stamp() {
      var d = new Date();
      return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    }

    var wrapped = function () {
      var mine = this === window.localStorage;
      try {
        var out = native.apply(this, arguments);
        if (mine) {
          pill.textContent = 'Salvato · ' + stamp();
          pill.classList.remove('is-failed', 'error');
        }
        return out;
      } catch (err) {
        if (mine) {
          pill.textContent = 'Non salvato';
          pill.classList.add('is-failed');
        }
        throw err;
      }
    };
    wrapped.__talWrapped = true;

    try { Storage.prototype.setItem = wrapped; } catch (e) {
      /* Se l'ambiente non consente la sostituzione, la barra resta sul
         messaggio neutro invece di inventarsi uno stato. */
    }
  }

  /* ------------------------------------------------- 2. informazioni sullo strumento */

  /* Contenitori di «Come si usa», uno per tool. LIPE costruisce il suo a
     runtime, quindi il tentativo si ripete qualche volta prima di arrendersi.
     `requestAnimationFrame` qui non va: in scheda non attiva non parte. */
  var HELP_SELECTORS = ['#view-help', '#view-method', '#lipe-help', '#stage-guide'];

  function movePublication(attempt) {
    var pub = document.querySelector('.tal-publication');
    if (!pub) return;
    var host = null;
    for (var i = 0; i < HELP_SELECTORS.length && !host; i++) {
      host = document.querySelector(HELP_SELECTORS[i]);
    }
    if (!host) {
      if ((attempt || 0) < 12) setTimeout(function () { movePublication((attempt || 0) + 1); }, 400);
      return;
    }
    host.appendChild(pub);
    pub.classList.add('tal-publication-inhelp');
    var det = pub.querySelector('details');
    if (det) det.open = true;
  }

  /* --------------------------------------------------- 3. colore dei pulsanti */

  /* Un pulsante che aggiunge e uno che modifica non possono avere lo stesso
     nero. La classificazione guarda l'etichetta perché è l'unica cosa che
     tutti e cinque i tool hanno in comune: fra loro i pulsanti non
     condividono né classi né attributi. */
  var TONE_SAVE = /^\s*(?:✓|✔)?\s*(?:salva|registra|memorizza|conferma e salva)\b/i;
  var TONE_ADD = /^\s*(?:\+|＋|✚)|(?:^|\b)(?:aggiungi|nuov[oa]|crea|inserisci|duplica|importa|carica|apri nuovo esercizio|riprendi dal mese precedente)\b/i;
  var TONE_EDIT = /(?:^|\b)(?:modifica|rettifica|riclassifica|storna|rinomina|sostituisci|aggiorna|riassegna|riordina|converti|correggi|applica|imposta|gestisci|riattiva|riporta)\b/i;

  /* Eccezioni: parole che sembrano dell'una o dell'altra famiglia e non lo
     sono. «Nuova elaborazione» non aggiunge niente, cancella tutto. */
  var TONE_NONE = /^(?:vai a|torna|apri dati|apri elenco)\b|nuova elaborazione|azzera|elimina|cancella|rimuovi|annulla|chiudi|indietro/i;

  var TONE_SKIP_CLASS = /\b(?:tab|sb-toggle|sb-swap|close-btn|modal-close|danger|del|fs-link|f24-link|lipe-link|workspace-link|tal-start-card|tal-start-demo|tal-gh-menu-toggle|tal-safety-detail|chev|adj-toggle)\b/;
  /* La barra di sessione è fuori dal gioco dei colori di proposito: lì
     «Nuovo» azzera l'elaborazione invece di aggiungere qualcosa, e verniciarlo
     di verde sarebbe l'esatto contrario di quello che fa. */
  var TONE_SKIP_ANCESTOR = '#sidebar,.appbar,.workspace-nav,.tal-global-header,.tal-site-footer,' +
    '.tabs,.cmd-menu,.tal-publication,.tal-session-bar,.cmdbar,.tal-fs-commandbar,.tal-commandbar';

  function toneFor(el) {
    var forced = el.getAttribute('data-tal-tone');
    if (forced) return forced === 'none' ? null : forced;
    if (TONE_SKIP_CLASS.test(el.className || '')) return null;
    if (el.closest && el.closest(TONE_SKIP_ANCESTOR)) return null;
    var t = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!t || t.length > 46) return null;
    if (TONE_NONE.test(t)) return null;
    if (TONE_SAVE.test(t)) return 'save';
    if (TONE_ADD.test(t)) return 'add';
    if (TONE_EDIT.test(t)) return 'edit';
    return null;
  }

  var TONE_CLASS = { add: 'add', edit: 'edit', save: 'save' };

  function paint(el) {
    if (!el || el.__talToned) return;
    var tone = toneFor(el);
    el.__talToned = true;
    if (!tone) return;
    el.classList.add('tal-tone-' + tone);
    if (el.classList.contains('btn')) el.classList.add(TONE_CLASS[tone]);
  }

  function paintAll(scope) {
    var nodes = (scope || document).querySelectorAll('button,a.btn,.btn,.lk');
    Array.prototype.forEach.call(nodes, paint);
  }

  function watchButtons() {
    paintAll(document);
    try {
      new MutationObserver(function (recs) {
        for (var i = 0; i < recs.length; i++) {
          var added = recs[i].addedNodes;
          for (var j = 0; j < added.length; j++) {
            var n = added[j];
            if (n.nodeType !== 1) continue;
            if (n.matches && n.matches('button,a.btn,.btn,.lk')) paint(n);
            if (n.querySelectorAll) paintAll(n);
          }
        }
      }).observe(document.body, { childList: true, subtree: true });
    } catch (e) {}
  }

  /* ------------------------------------------------ 4. Configura con AI a parte */

  function externalizeAiLink() {
    var links = document.querySelectorAll('a[href*="/configura-con-ai/"]');
    Array.prototype.forEach.call(links, function (a) {
      if (a.closest('.tal-global-header,.tal-site-footer')) return;
      a.target = '_blank';
      a.rel = 'noopener';
      if (!/scheda nuova/i.test(a.title || '')) {
        a.title = 'Si apre in una scheda nuova: la sessione di lavoro resta aperta.';
      }
    });
  }

  /* Bilancio e Analisi costruiscono la propria barra da un listener su
     DOMContentLoaded. Questo file è `defer`, quindi gira *prima* che quel
     listener parta: cercare la barra subito la trova assente e ne nascerebbe
     una seconda. Se succede lo stesso, questa se ne va. */
  function reconcileBar() {
    var mine = document.querySelector('.tal-cmdbar.tal-session-bar');
    if (!mine) return;
    var theirs = document.querySelector(BAR_SELECTORS + ':not(.tal-cmdbar)');
    if (!theirs) return;
    mine.parentNode.removeChild(mine);
    buildBar();
  }

  /* Salto al contenuto, per i cinque tool.
     Da tastiera, prima del contenuto, si attraversano intestazione globale,
     barra di sessione e sidebar intera: decine di tabulazioni a ogni cambio di
     schermata. Solo Analisi di bilancio aveva un salto proprio (TAL-P2-04).
     È idempotente: se un tool ne ha già uno non ne aggiunge un secondo, così
     due salti di fila non diventano il difetto successivo. */
  function installSkipLink() {
    if (document.querySelector('.tal-skip-link, .skip-link')) return;
    var main = document.querySelector('.app-main main')
            || document.querySelector('main')
            || document.querySelector('.app-main');
    if (!main) return;
    if (!main.id) main.id = 'tal-main-content';
    /* tabindex="-1": in Safari un'ancora verso un contenitore non focusabile
       sposta la vista ma non il fuoco, e la tabulazione successiva riparte
       dall'inizio — il salto sembra funzionare e non serve a niente. */
    if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
    var a = document.createElement('a');
    a.className = 'tal-skip-link';
    a.href = '#' + main.id;
    a.textContent = 'Vai al contenuto principale';
    a.addEventListener('click', function () {
      setTimeout(function () { try { main.focus({ preventScroll: false }); } catch (e) { main.focus(); } }, 0);
    });
    document.body.insertAdjacentElement('afterbegin', a);
  }

  /* Il limite dichiarato prima del caricamento, non scoperto dopo il
     fallimento (TAL-P1-08). Si attacca a ogni input per file XLSX: i tool ne
     hanno da uno a cinque, e prima nessuno diceva quanto grande può essere un
     file prima di far morire la scheda. */
  function declareUploadLimits() {
    if (!window.TAL_LIMITS) return;
    var testo = window.TAL_LIMITS.describe('xlsx');
    var inputs = document.querySelectorAll('input[type="file"][accept*="xls"]');
    for (var i = 0; i < inputs.length; i++) {
      var input = inputs[i];
      if (input.dataset.talLimitShown) continue;
      input.dataset.talLimitShown = '1';
      /* L'input è spesso nascosto dietro un pulsante o una zona di trascinamento:
         la nota va accanto a quello che si vede, non all'input. */
      var host = input.closest('.dropzone, .upload, .panel, .field, .import-step') || input.parentElement;
      if (!host || host.querySelector('.tal-upload-limit')) continue;
      var nota = document.createElement('p');
      nota.className = 'tal-upload-limit';
      nota.textContent = testo;
      host.appendChild(nota);
    }
  }

  function start() {
    buildBar();
    watchStorage();
    movePublication(0);
    externalizeAiLink();
    watchButtons();
    installSkipLink();
    declareUploadLimits();
    /* La sidebar e la barra di qualche tool nascono dopo il boot: vanno
       riprese quando compaiono. `requestAnimationFrame` qui non serve — in
       scheda non attiva non parte. */
    setTimeout(function () { reconcileBar(); externalizeAiLink(); declareUploadLimits(); }, 800);
  }

  function boot() { setTimeout(start, 0); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
