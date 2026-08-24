/*! tal-focus-guard.js — Tax Automation Lab
 *  Le finestre di dialogo dei sei tool sono scritte in sei modi diversi, e
 *  nessuno dei sei tratteneva il tabulatore: aperta una finestra, premendo Tab
 *  si finiva a girare fra i pulsanti che stanno sotto, senza vederli. Chi usa
 *  il mouse non se ne accorge mai; chi usa la tastiera si perde ogni volta.
 *
 *  Questo file non conosce nessuno dei sei tool. Guarda soltanto se in pagina
 *  c'e' un elemento con `role="dialog"` visibile, e in quel caso fa tre cose:
 *
 *    1. tiene il tabulatore dentro la finestra, in cerchio;
 *    2. le da' un nome accessibile, se non ce l'ha, prendendolo dalla sua
 *       intestazione — il Bilancio aveva due finestre senza nome;
 *    3. alla chiusura rimette il fuoco dove stava, invece di lasciarlo cadere
 *       sul `body`: da li' il prossimo Tab riparte dall'inizio della pagina.
 *
 *  Interviene solo quando il tool non ha gia' fatto la cosa giusta: il
 *  Fascicolo il fuoco lo restituisce da solo, e li' questo file non tocca
 *  niente.
 *
 *  Copyright (c) 2026 Riccardo Zedda — MIT, vedi /legal-docs/MIT.txt
 */
(function () {
  'use strict';

  var DIALOGHI = '[role="dialog"], dialog[open]';
  var FOCALIZZABILI = 'a[href], button, input, select, textarea, summary, [tabindex]';

  var grilletto = null;   /* chi ha aperto l'ultima finestra */
  var aperta = null;      /* la finestra che consideriamo aperta adesso */
  var contatore = 0;

  function visibile(el) {
    if (!el || !el.getBoundingClientRect) return false;
    if (el.hasAttribute('hidden') || el.getAttribute('aria-hidden') === 'true') return false;
    var s = window.getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  /* L'ultima visibile e' quella in cima: se un tool ne apre due sovrapposte,
     comanda la piu' recente. */
  function inCima() {
    var trovate = [];
    var tutte = document.querySelectorAll(DIALOGHI);
    for (var i = 0; i < tutte.length; i++) if (visibile(tutte[i])) trovate.push(tutte[i]);
    return trovate.length ? trovate[trovate.length - 1] : null;
  }

  function dentro(d) {
    var out = [];
    var tutti = d.querySelectorAll(FOCALIZZABILI);
    for (var i = 0; i < tutti.length; i++) {
      var e = tutti[i];
      if (e.disabled) continue;
      if (e.getAttribute('tabindex') === '-1') continue;
      if (e.type === 'hidden') continue;
      if (!visibile(e)) continue;
      out.push(e);
    }
    return out;
  }

  /* Il grilletto si segna *prima* che la finestra si apra: dopo, il tool ha
     spesso gia' ridisegnato mezza pagina e l'elemento non e' piu' quello. */
  function segna(e) {
    if (inCima()) return;
    var t = e.target;
    if (!t || !t.closest) return;
    t = t.closest('a[href], button, [role="button"], summary, [tabindex]');
    if (t) grilletto = t;
  }
  document.addEventListener('pointerdown', segna, true);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') segna(e);
  }, true);

  function nomina(d) {
    if (d.getAttribute('aria-label') || d.getAttribute('aria-labelledby')) return;
    var h = d.querySelector('h1, h2, h3, h4');
    if (!h || !String(h.textContent || '').trim()) return;
    if (!h.id) h.id = 'tal-nome-finestra-' + (++contatore);
    d.setAttribute('aria-labelledby', h.id);
  }

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab' || e.ctrlKey || e.altKey || e.metaKey) return;
    var d = inCima();
    if (!d) return;
    var f = dentro(d);
    if (!f.length) return;
    var a = document.activeElement;
    if (!d.contains(a)) { e.preventDefault(); f[0].focus(); return; }
    var i = f.indexOf(a);
    if (!e.shiftKey && (i === -1 || i === f.length - 1)) { e.preventDefault(); f[0].focus(); }
    else if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
  }, true);

  /* Dove rimettere il fuoco quando chi lo aveva non c'e' piu': l'inizio del
     contenuto, non l'inizio della pagina. */
  function casa() {
    return document.getElementById('page') || document.querySelector('main') || null;
  }

  /* Quando la finestra sparisce il browser toglie il fuoco a chi ce l'aveva, ma
     non sempre entro la stessa svolta: si guarda un attimo dopo, e si conta
     perso anche il fuoco rimasto su un elemento che nel frattempo non si vede
     piu'. */
  function perso() {
    var a = document.activeElement;
    if (!a || a === document.body || a === document.documentElement) return true;
    return !document.contains(a) || !visibile(a);
  }

  function ripristina() {
    if (inCima()) return;
    if (!perso()) return;
    if (grilletto && document.contains(grilletto) && visibile(grilletto)) { grilletto.focus(); return; }
    var c = casa();
    if (!c) return;
    if (!c.hasAttribute('tabindex')) c.setAttribute('tabindex', '-1');
    c.focus();
  }

  function guarda() {
    var d = inCima();
    if (d === aperta) return;
    if (d) { nomina(d); aperta = d; return; }
    aperta = null;
    window.setTimeout(ripristina, 0);
  }

  /* Un ridisegno di questi tool produce centinaia di mutazioni: `guarda` deve
     girare una volta sola per svolta, non una per mutazione. */
  var inCoda = false;
  function accoda() {
    if (inCoda) return;
    inCoda = true;
    window.setTimeout(function () { inCoda = false; guarda(); }, 0);
  }

  if (window.MutationObserver) {
    new MutationObserver(accoda).observe(document.documentElement, {
      subtree: true, childList: true, attributes: true,
      attributeFilter: ['class', 'style', 'hidden', 'open', 'aria-hidden', 'role']
    });
  }
  document.addEventListener('keyup', accoda, true);
  document.addEventListener('click', accoda, true);
})();
