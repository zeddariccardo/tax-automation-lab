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
      /* Niente distanziatore: la pastiglia si spinge a destra da sola con
         `margin-left:auto`. Un elemento elastico in mezzo, su telefono, si
         prendeva una riga tutta sua e la striscia andava a tre righe. */
      if (!bar.querySelector('.save-pill,.tal-save-pill')) {
        bar.insertAdjacentHTML('beforeend', pillHtml('talSavePill'));
      }
      return bar;
    }

    /* Nessuna barra propria (LIPE): se ne costruisce una, con l'etichetta e lo
       stato del salvataggio. Niente nome della società: è nella sidebar. */
    bar = document.createElement('div');
    bar.className = 'cmdbar tal-cmdbar tal-session-bar';
    bar.setAttribute('aria-label', 'Sessione di lavoro');
    bar.innerHTML =
      '<span class="tal-session-label">Sessione di lavoro</span>' +
      pillHtml('talSavePill');

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

  function start() {
    buildBar();
    watchStorage();
    movePublication(0);
    externalizeAiLink();
    watchButtons();
    /* La sidebar e la barra di qualche tool nascono dopo il boot: vanno
       riprese quando compaiono. `requestAnimationFrame` qui non serve — in
       scheda non attiva non parte. */
    setTimeout(function () { reconcileBar(); externalizeAiLink(); }, 800);
  }

  function boot() { setTimeout(start, 0); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
