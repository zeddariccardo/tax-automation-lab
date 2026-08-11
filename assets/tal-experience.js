/* Tax Automation Lab — livello di esperienza condiviso (v7.0)
   Sfondo vivo, stato dell'header allo scroll e comparsa progressiva dei blocchi.
   Non tocca le pagine applicative (html.tal-tool-page) né la logica esistente:
   aggiunge soltanto elementi decorativi e classi di stato. */
(function () {
  'use strict';

  var root = document.documentElement;
  if (root.classList.contains('tal-tool-page')) return;

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* --- 1. Sfondo ---------------------------------------------------------- */

  /* I fasci luminosi riprendono i tubi della schermata d'ingresso, ma disegnati
     in SVG invece che in WebGL: nessuna libreria esterna da scaricare a ogni
     pagina, nessun contesto 3D sempre acceso, e il movimento si riduce a poche
     trasformazioni che la GPU compone senza ridisegnare nulla.

     Ogni filo è tracciato tre volte — alone largo, corpo, nucleo sottile — così
     il bagliore nasce dalla geometria e non da un filtro di sfocatura, che a
     tutto schermo costerebbe un ridisegno per fotogramma. */
  var STRANDS = [
    { d: 'M-120,690 C 200,545 380,860 700,752 S 1180,505 1580,595', g: 'talTubePetrol', w: 26, o: 1 },
    { d: 'M-120,752 C 225,610 405,900 725,795 S 1200,552 1580,648', g: 'talTubeTeal',   w: 20, o: .9 },
    { d: 'M-120,628 C 180,486 360,812 680,712 S 1160,470 1580,540', g: 'talTubeViolet', w: 16, o: .78 },
    { d: 'M-80,900 C 120,700 40,505 262,455 C 430,417 486,600 388,706 C 300,800 108,788 44,700',
      g: 'talTubeRust', w: 14, o: .72 },
    { d: 'M-120,824 C 262,700 424,944 764,842 S 1244,600 1580,690', g: 'talTubeTeal',   w: 12, o: .6 },
    /* Il filo alto passa dietro al titolo: resta appena accennato. */
    { d: 'M-120,286 C 262,205 424,415 764,332 S 1244,150 1580,232', g: 'talTubeViolet', w: 11, o: .3 }
  ];

  var TUBE_GRADIENTS = [
    ['talTubePetrol', '#1d6f8c', '#3fc0dd', '#0f5468'],
    ['talTubeTeal',   '#12586e', '#57d6e4', '#124a5e'],
    ['talTubeViolet', '#4a2168', '#a867d8', '#3a1f56'],
    ['talTubeRust',   '#5c3a24', '#d79a63', '#4a2168']
  ];

  function buildTubes() {
    var wrap = document.createElement('div');
    wrap.className = 'tal-bg__tubes';

    var defs = TUBE_GRADIENTS.map(function (g) {
      return '<linearGradient id="' + g[0] + '" x1="0" y1="0" x2="1" y2="0.35">' +
        '<stop offset="0" stop-color="' + g[1] + '" stop-opacity="0"/>' +
        '<stop offset="0.22" stop-color="' + g[1] + '"/>' +
        '<stop offset="0.55" stop-color="' + g[2] + '"/>' +
        '<stop offset="0.86" stop-color="' + g[3] + '"/>' +
        '<stop offset="1" stop-color="' + g[3] + '" stop-opacity="0"/>' +
        '</linearGradient>';
    }).join('');

    /* Tre gruppi con derive diverse: i fili non si muovono all'unisono e il
       fascio sembra respirare invece di scorrere in blocco. */
    var groups = [[], [], []];
    STRANDS.forEach(function (s, i) {
      var layer =
        '<path d="' + s.d + '" stroke="url(#' + s.g + ')" stroke-width="' + s.w + '" opacity="' + (s.o * 0.14).toFixed(3) + '"/>' +
        '<path d="' + s.d + '" stroke="url(#' + s.g + ')" stroke-width="' + (s.w * 0.36).toFixed(1) + '" opacity="' + (s.o * 0.34).toFixed(3) + '"/>' +
        '<path d="' + s.d + '" stroke="url(#' + s.g + ')" stroke-width="' + Math.max(1.4, s.w * 0.11).toFixed(1) + '" opacity="' + (s.o * 0.72).toFixed(3) + '"/>';
      groups[i % 3].push(layer);
    });

    wrap.innerHTML =
      '<svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
      '<defs>' + defs + '</defs>' +
      '<g fill="none" stroke-linecap="round">' +
      groups.map(function (paths, i) {
        return '<g class="tal-tube-group tal-tube-group--' + (i + 1) + '">' + paths.join('') + '</g>';
      }).join('') +
      '</g></svg>';

    return wrap;
  }

  function buildBackground() {
    if (document.querySelector('.tal-bg')) return;

    var bg = document.createElement('div');
    bg.className = 'tal-bg';
    bg.setAttribute('aria-hidden', 'true');

    ['rust', 'purple', 'violet', 'petrol', 'teal'].forEach(function (name) {
      var blob = document.createElement('div');
      blob.className = 'tal-bg__blob tal-bg__blob--' + name;
      bg.appendChild(blob);
    });

    bg.appendChild(buildTubes());

    ['grid', 'grain', 'vignette'].forEach(function (name) {
      var layer = document.createElement('div');
      layer.className = 'tal-bg__' + name;
      bg.appendChild(layer);
    });

    document.body.insertBefore(bg, document.body.firstChild);

    /* Dissolvenza incrociata con il fondo statico di riserva. Il timeout copre
       il caso in cui requestAnimationFrame non venga servito (scheda non attiva). */
    var live = function () { root.classList.add('tal-bg-live'); };
    requestAnimationFrame(live);
    setTimeout(live, 140);
  }

  /* --- 2. Header allo scroll e avanzamento di lettura ---------------------- */

  /* La barra di avanzamento ha senso dove c'è davvero da leggere. */
  function buildProgress() {
    var isLong = document.querySelector('.content, .panel');
    if (!isLong || document.querySelector('.tal-progress')) return null;
    var bar = document.createElement('div');
    bar.className = 'tal-progress';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);
    return bar;
  }

  function watchScroll() {
    var bar = buildProgress();
    var ticking = false;
    function apply() {
      root.classList.toggle('tal-scrolled', window.scrollY > 14);
      if (bar) {
        var max = document.documentElement.scrollHeight - window.innerHeight;
        var ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
        bar.style.transform = 'scaleX(' + ratio.toFixed(4) + ')';
      }
      ticking = false;
    }
    apply();
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(apply);
    }, { passive: true });
  }

  /* --- 3. Comparsa progressiva -------------------------------------------- */

  var REVEAL = [
    '.hero', '.home-hero', '.page-header', '.section-head', '.collaborations-head',
    '.lab-goals-wrap', '.ai-onboarding-teaser', '.onboarding-banner', '.method-strip',
    '.featured', '.contact', '.license-card', '.compare-wrap', '.collab-preview',
    '.collab-apply', '.profile>article', '.profile>aside', '.toc',
    '.card', '.case-card', '.tool-card-v614', '.tool-card', '.tool-suite-card',
    '.insight-card', '.method-card', '.principle', '.value-card', '.panel', '.step',
    '.upload-card', '.doc-box', '.callout', '.screen-pair', '.flow'
  ].join(',');

  /* Lo sfalsamento ha senso solo dove gli elementi entrano affiancati. */
  var STAGGER_PARENTS = '.grid,.case-grid,.insights-grid,.tool-suite-grid,.method-grid,' +
    '.principles,.value-strip,.tool-grid,.steps,.credentials,.upload-grid,.profile';

  function markReveal() {
    var nodes = document.querySelectorAll(REVEAL);
    var marked = [];
    Array.prototype.forEach.call(nodes, function (el) {
      /* Un solo livello di comparsa: se un antenato si anima già, il figlio no. */
      if (el.parentElement && el.parentElement.closest('[data-tal-reveal]')) return;
      el.setAttribute('data-tal-reveal', '');
      marked.push(el);
    });

    marked.forEach(function (el) {
      var parent = el.parentElement;
      if (!parent || !parent.matches(STAGGER_PARENTS)) return;
      var index = 0;
      var sibling = el.previousElementSibling;
      while (sibling) {
        if (sibling.hasAttribute('data-tal-reveal')) index++;
        sibling = sibling.previousElementSibling;
      }
      el.style.setProperty('--tal-i', String(Math.min(index, 5)));
    });

    return marked;
  }

  function observe(elements) {
    if (!('IntersectionObserver' in window)) {
      elements.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    elements.forEach(function (el) { io.observe(el); });

    /* Rete di sicurezza: se nulla è comparso, il contenuto torna visibile.
       Nessuna animazione vale una pagina bianca. */
    setTimeout(function () {
      if (document.querySelector('[data-tal-reveal].is-in')) return;
      io.disconnect();
      elements.forEach(function (el) { el.removeAttribute('data-tal-reveal'); });
    }, 2600);
  }

  function startReveal() {
    /* Marcatura e osservazione nello stesso task: se l'osservatore partisse in
       un frame successivo, una scheda in secondo piano resterebbe vuota. */
    observe(markReveal());
  }

  /* In home il contenuto resta nascosto finché non si esce dalla schermata
     iniziale: la comparsa parte da lì, altrimenti scorrerebbe a vuoto. */
  function scheduleReveal() {
    var app = document.getElementById('app');
    if (!app || app.classList.contains('is-visible')) {
      startReveal();
      return;
    }
    var mo = new MutationObserver(function () {
      if (!app.classList.contains('is-visible')) return;
      mo.disconnect();
      setTimeout(startReveal, 120);
    });
    mo.observe(app, { attributes: true, attributeFilter: ['class'] });
  }

  /* --- Avvio --------------------------------------------------------------- */

  function init() {
    if (!reduced) root.classList.add('tal-motion');
    buildBackground();
    watchScroll();
    if (!reduced) scheduleReveal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
