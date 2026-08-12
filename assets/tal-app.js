/* Tax Automation Lab — barra comandi condivisa (v1.0)
   ---------------------------------------------------------------------------
   Tre tool su quattro non dicevano mai chi fosse il cliente attivo né se il
   lavoro fosse al sicuro. Questa barra lo dice, con una regola: non deve
   mentire. Un indicatore «Salvato» che si accende senza che nulla sia stato
   scritto è peggio che non averlo.

   Per questo non si fida delle funzioni di salvataggio dei singoli tool — ce
   ne sono da tre a sette per tool, con nomi diversi — ma osserva la scrittura
   vera: localStorage.setItem. Se la scrittura riesce, lo dice; se fallisce
   (memoria piena, navigazione privata), lo dice altrettanto.

   Il Fascicolo fiscale cliente ha già una barra propria: qui non fa nulla. */
(function () {
  'use strict';

  var root = document.documentElement;
  if (!root.classList.contains('tal-tool-page')) return;

  function build() {
    var main = document.querySelector('.app-main');
    if (!main || document.querySelector('.cmdbar')) return;

    var header = main.querySelector('.tal-global-header');
    var context = document.querySelector('.sb-context');

    var bar = document.createElement('div');
    bar.className = 'cmdbar tal-cmdbar';
    bar.setAttribute('aria-label', 'Stato del lavoro');
    bar.innerHTML =
      '<div class="cmd-context">' +
      '<b id="talCmdClient">Nessun cliente</b>' +
      '<span id="talCmdMeta">Scegli un cliente per iniziare</span>' +
      '</div>' +
      '<span class="save-pill tal-save-pill" id="talSavePill">Salvataggio automatico</span>';

    var anchor = main.querySelector('.tal-tool-safety') || header;
    if (anchor && anchor.parentNode === main) anchor.insertAdjacentElement('afterend', bar);
    else main.insertBefore(bar, main.firstChild);

    mirrorContext(context);
    watchStorage();
  }

  /* Il contesto lo tengono già aggiornato i tool nella sidebar: lo rispecchio
     invece di ricalcolarlo, così non esistono due verità sullo stesso dato. */
  function mirrorContext(source) {
    if (!source) return;
    var nameEl = document.getElementById('talCmdClient');
    var metaEl = document.getElementById('talCmdMeta');

    function sync() {
      var b = source.querySelector('b');
      var name = (b ? b.textContent : '').trim();
      var meta = '';
      /* Un tool mette il dettaglio in uno <span>, un altro lo lascia come testo
         libero accanto al nome: leggo entrambi invece di indovinare. */
      Array.prototype.forEach.call(source.childNodes, function (n) {
        if (n === b) return;
        if (n.nodeType === 1 && n.classList && n.classList.contains('sb-swap')) return;
        var t = (n.textContent || '').trim();
        if (t && t !== name) meta = meta ? meta + ' · ' + t : t;
      });
      /* Con un cliente scelto la riga sotto resta vuota se il tool non ha altro
         da dire: ripetere «scegli un cliente» quando ne è già stato scelto uno
         sarebbe una piccola bugia. */
      var chosen = name && !/^nessun/i.test(name);
      if (name) nameEl.textContent = name;
      metaEl.textContent = meta || (chosen ? '' : 'Scegli un cliente per iniziare');
      metaEl.hidden = !metaEl.textContent;
    }

    sync();
    try {
      new MutationObserver(sync).observe(source, {
        childList: true, subtree: true, characterData: true
      });
    } catch (e) {}
  }

  /* Stato del salvataggio osservato sulla scrittura reale. */
  function watchStorage() {
    var pill = document.getElementById('talSavePill');
    if (!pill || !window.localStorage) return;

    var native = window.localStorage.setItem;
    if (native.__talWrapped) return;

    function stamp() {
      var d = new Date();
      return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    }

    var wrapped = function (key, value) {
      try {
        var out = native.apply(window.localStorage, arguments);
        pill.textContent = 'Salvato · ' + stamp();
        pill.classList.remove('is-failed');
        return out;
      } catch (err) {
        pill.textContent = 'Non salvato';
        pill.classList.add('is-failed');
        throw err;
      }
    };
    wrapped.__talWrapped = true;

    try {
      window.localStorage.setItem = wrapped;
    } catch (e) {
      /* Se l'ambiente non consente di sostituire il metodo, la barra resta
         sul messaggio neutro invece di inventarsi uno stato. */
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build, { once: true });
  } else {
    build();
  }
})();
