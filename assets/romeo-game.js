(() => {
  'use strict';

  const COPY = {
    it: {
      background: 'Background', family: 'Famiglia', familyPrefix: 'Marito e', dad: 'papà',
      openLabel: 'Apri Il primo bilancio di Romeo', closeLabel: 'Chiudi il gioco',
      title: 'Il primo bilancio di Romeo',
      balanceSheet: 'Stato patrimoniale', incomeStatement: 'Conto economico',
      zones: { assets: 'Attivo', liabilities: 'Passivo', equity: 'Patrimonio netto', revenue: 'Ricavi', raw: 'Materie prime', services: 'Servizi', staff: 'Personale' },
      items: { car: 'Macchinina', house: 'Casetta', cash: 'Sacchetto di denaro', loan: 'Prestito bancario', bill: 'Fattura da pagare', capital: 'Capitale', customer: 'Cliente che paga', brick: 'Mattoncino', cleaner: 'Servizio di pulizia', worker: 'Lavoratore' },
      letter: 'Se un giorno leggerai queste righe, probabilmente sarai abbastanza grande da capire che in ogni cosa che faccio, anche se sono distante, ti porto con me.\n\nOgni ora dedicata a questo progetto, o ad altri, ha solo un obiettivo, quello di costruire qualcosa che possa creare valore.\n\nSpero che qualunque cosa ti appassioni nella vita, tu abbia il coraggio di dedicarle tempo.\nPerché il tempo speso in ciò che ti appassiona o ti entusiasma non è mai tempo perso.\n\nCon amore,\nPapà'
    },
    en: {
      background: 'Background', family: 'Family', familyPrefix: 'Husband and', dad: 'dad',
      openLabel: "Open Romeo's first balance sheet", closeLabel: 'Close the game',
      title: "Romeo's first balance sheet",
      balanceSheet: 'Balance sheet', incomeStatement: 'Income statement',
      zones: { assets: 'Assets', liabilities: 'Liabilities', equity: 'Equity', revenue: 'Revenue', raw: 'Raw materials', services: 'Services', staff: 'Personnel' },
      items: { car: 'Toy car', house: 'House', cash: 'Bag of money', loan: 'Bank loan', bill: 'Bill to pay', capital: 'Capital', customer: 'Paying customer', brick: 'Building block', cleaner: 'Cleaning service', worker: 'Worker' },
      letter: 'If one day you read these lines, you will probably be old enough to understand that in everything I do, even when I am far away, I carry you with me.\n\nEvery hour devoted to this project, or to others, has only one purpose: to build something that can create value.\n\nI hope that, whatever you become passionate about in life, you will have the courage to devote time to it.\nBecause time spent on what you are passionate or excited about is never time wasted.\n\nWith love,\nDad'
    },
    es: {
      background: 'Trayectoria', family: 'Familia', familyPrefix: 'Marido y', dad: 'papá',
      openLabel: 'Abrir el primer balance de Romeo', closeLabel: 'Cerrar el juego',
      title: 'El primer balance de Romeo',
      balanceSheet: 'Balance', incomeStatement: 'Cuenta de resultados',
      zones: { assets: 'Activo', liabilities: 'Pasivo', equity: 'Patrimonio neto', revenue: 'Ingresos', raw: 'Materias primas', services: 'Servicios', staff: 'Personal' },
      items: { car: 'Coche de juguete', house: 'Casita', cash: 'Bolsa de dinero', loan: 'Préstamo bancario', bill: 'Factura por pagar', capital: 'Capital', customer: 'Cliente que paga', brick: 'Bloque de construcción', cleaner: 'Servicio de limpieza', worker: 'Trabajador' },
      letter: 'Si algún día lees estas líneas, probablemente serás lo bastante mayor para comprender que, en todo lo que hago, incluso cuando estoy lejos, te llevo conmigo.\n\nCada hora dedicada a este proyecto, o a otros, tiene un único objetivo: construir algo que pueda crear valor.\n\nEspero que, sea lo que sea que te apasione en la vida, tengas el valor de dedicarle tiempo.\nPorque el tiempo dedicado a lo que te apasiona o te entusiasma nunca es tiempo perdido.\n\nCon amor,\nPapá'
    }
  };

  const BINARY_ROMEO = ['01010010', '01001111', '01001101', '01000101', '01001111'];

  const ITEMS = [
    { id: 'car', zone: 'assets' }, { id: 'house', zone: 'assets' }, { id: 'cash', zone: 'assets' },
    { id: 'loan', zone: 'liabilities' }, { id: 'bill', zone: 'liabilities' }, { id: 'capital', zone: 'equity' },
    { id: 'customer', zone: 'revenue' }, { id: 'brick', zone: 'raw' }, { id: 'cleaner', zone: 'services' }, { id: 'worker', zone: 'staff' }
  ];

  const SVG = {
    car: `<svg viewBox="0 0 96 96" aria-hidden="true"><path d="M19 53 27 37c2-4 5-6 10-6h24c5 0 8 2 11 7l7 15" fill="#4fc3d8" stroke="#17364a" stroke-width="4" stroke-linejoin="round"/><path d="M13 52h68c4 0 7 3 7 7v13H8V60c0-5 2-8 5-8Z" fill="#8d55c7" stroke="#352044" stroke-width="4"/><path d="M32 36h14v16H24l8-16Zm18 0h11c3 0 5 1 7 5l5 11H50V36Z" fill="#dff6fb" stroke="#17364a" stroke-width="3"/><circle cx="25" cy="72" r="9" fill="#263447" stroke="#111827" stroke-width="3"/><circle cx="25" cy="72" r="3" fill="#cbd5e1"/><circle cx="70" cy="72" r="9" fill="#263447" stroke="#111827" stroke-width="3"/><circle cx="70" cy="72" r="3" fill="#cbd5e1"/><circle cx="19" cy="59" r="3" fill="#ffe08a"/></svg>`,
    house: `<svg viewBox="0 0 96 96" aria-hidden="true"><path d="M12 45 48 15l36 30" fill="#d75f86" stroke="#51243a" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 43h54v39H21z" fill="#f1c477" stroke="#704c2a" stroke-width="4"/><path d="M39 82V58h18v24" fill="#8d55c7" stroke="#482b63" stroke-width="4"/><rect x="27" y="50" width="12" height="12" rx="2" fill="#dff6fb" stroke="#28536a" stroke-width="3"/><rect x="58" y="50" width="11" height="12" rx="2" fill="#dff6fb" stroke="#28536a" stroke-width="3"/><circle cx="52" cy="70" r="2" fill="#ffe08a"/></svg>`,
    cash: `<svg viewBox="0 0 96 96" aria-hidden="true"><path d="M35 20c8 5 18 5 26 0l-5 15H40l-5-15Z" fill="#7fd1a0" stroke="#24543a" stroke-width="4" stroke-linejoin="round"/><path d="M40 35h16c14 10 23 24 20 37-3 12-15 16-28 16S23 84 20 72c-3-13 6-27 20-37Z" fill="#86d7a7" stroke="#24543a" stroke-width="4"/><path d="M37 35c6 3 16 3 22 0" fill="none" stroke="#24543a" stroke-width="4" stroke-linecap="round"/><circle cx="48" cy="61" r="13" fill="#ffe08a" stroke="#9c6b20" stroke-width="3"/><path d="M52 54c-2-2-8-2-8 2 0 5 9 3 9 8 0 5-8 5-11 2m6-16v22" fill="none" stroke="#8b5d18" stroke-width="3" stroke-linecap="round"/></svg>`,
    loan: `<svg viewBox="0 0 96 96" aria-hidden="true"><path d="M10 39 48 17l38 22" fill="#8d55c7" stroke="#3e2555" stroke-width="4" stroke-linejoin="round"/><path d="M16 39h64v10H16z" fill="#cbb5e6" stroke="#3e2555" stroke-width="4"/><path d="M23 49h10v26H23zm20 0h10v26H43zm20 0h10v26H63z" fill="#ece7f4" stroke="#3e2555" stroke-width="3"/><path d="M13 75h70v9H13z" fill="#cbb5e6" stroke="#3e2555" stroke-width="4"/><circle cx="72" cy="69" r="15" fill="#f1c477" stroke="#704c2a" stroke-width="3"/><path d="M72 61v16m-5-11 5-5 5 5" fill="none" stroke="#704c2a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    bill: `<svg viewBox="0 0 96 96" aria-hidden="true"><path d="M24 12h41l10 10v62H24z" fill="#f7f2e9" stroke="#4b5563" stroke-width="4" stroke-linejoin="round"/><path d="M65 12v12h12" fill="#d8e3ec" stroke="#4b5563" stroke-width="4" stroke-linejoin="round"/><path d="M34 36h31M34 47h25M34 58h20" stroke="#7f8a97" stroke-width="4" stroke-linecap="round"/><circle cx="63" cy="68" r="13" fill="#e96d78" stroke="#7b2d37" stroke-width="3"/><path d="m57 62 12 12m0-12L57 74" stroke="#fff" stroke-width="4" stroke-linecap="round"/></svg>`,
    capital: `<svg viewBox="0 0 96 96" aria-hidden="true"><ellipse cx="43" cy="69" rx="27" ry="11" fill="#d9a35f" stroke="#765126" stroke-width="4"/><path d="M16 57v12c0 6 12 11 27 11s27-5 27-11V57" fill="#e8bb72" stroke="#765126" stroke-width="4"/><ellipse cx="43" cy="57" rx="27" ry="11" fill="#f2c77f" stroke="#765126" stroke-width="4"/><path d="M43 46V18" stroke="#28536a" stroke-width="4" stroke-linecap="round"/><path d="M45 20h28L62 31l11 11H45" fill="#4fc3d8" stroke="#28536a" stroke-width="3" stroke-linejoin="round"/><circle cx="43" cy="58" r="7" fill="#ffe4a6" stroke="#9c6b20" stroke-width="2"/></svg>`,
    customer: `<svg viewBox="0 0 96 96" aria-hidden="true"><circle cx="31" cy="27" r="12" fill="#f0b58f" stroke="#754c38" stroke-width="3"/><path d="M15 76V55c0-10 7-17 16-17s16 7 16 17v21" fill="#4fc3d8" stroke="#28536a" stroke-width="4" stroke-linejoin="round"/><path d="M43 52c10 0 16 5 21 10" fill="none" stroke="#754c38" stroke-width="5" stroke-linecap="round"/><circle cx="70" cy="65" r="14" fill="#ffe08a" stroke="#9c6b20" stroke-width="3"/><path d="M74 58c-3-2-8-1-8 2 0 5 9 3 9 8 0 4-7 5-11 2m6-16v22" fill="none" stroke="#8b5d18" stroke-width="3" stroke-linecap="round"/><path d="M18 75h56" stroke="#374151" stroke-width="4" stroke-linecap="round"/></svg>`,
    brick: `<svg viewBox="0 0 96 96" aria-hidden="true"><path d="M12 34h72v48H12z" fill="#d9775b" stroke="#783d2e" stroke-width="4"/><path d="M12 50h72M12 66h72M30 34v16m36-16v16M21 50v16m36-16v16m27-16v16M30 66v16m36-16v16" stroke="#f1b19b" stroke-width="3"/><path d="M22 22h52v12H22z" fill="#e88b6c" stroke="#783d2e" stroke-width="4"/><path d="M48 22v12" stroke="#f1b19b" stroke-width="3"/></svg>`,
    cleaner: `<svg viewBox="0 0 96 96" aria-hidden="true"><circle cx="35" cy="24" r="11" fill="#efb38d" stroke="#744b37" stroke-width="3"/><path d="M20 70V49c0-9 6-15 15-15s15 6 15 15v21" fill="#8d55c7" stroke="#482b63" stroke-width="4"/><path d="M45 43 67 67" stroke="#744b37" stroke-width="5" stroke-linecap="round"/><path d="M69 31 55 82" stroke="#8b5d3c" stroke-width="5" stroke-linecap="round"/><path d="M50 80h18l-4 8H47z" fill="#4fc3d8" stroke="#28536a" stroke-width="3" stroke-linejoin="round"/><path d="M13 72h38" stroke="#374151" stroke-width="4" stroke-linecap="round"/><path d="M65 24c5 0 9 4 9 9" fill="none" stroke="#dff6fb" stroke-width="4" stroke-linecap="round"/></svg>`,
    worker: `<svg viewBox="0 0 96 96" aria-hidden="true"><path d="M29 26c0-12 8-19 19-19s19 7 19 19" fill="#ffe08a" stroke="#8b5d18" stroke-width="4"/><path d="M24 27h48" stroke="#8b5d18" stroke-width="5" stroke-linecap="round"/><circle cx="48" cy="35" r="13" fill="#efb38d" stroke="#744b37" stroke-width="3"/><path d="M22 84V61c0-10 9-18 26-18s26 8 26 18v23" fill="#4fc3d8" stroke="#28536a" stroke-width="4"/><path d="M38 46 48 60l10-14M48 60v24" fill="none" stroke="#f7f2e9" stroke-width="4" stroke-linejoin="round"/><path d="M16 84h64" stroke="#374151" stroke-width="4" stroke-linecap="round"/></svg>`
  };

  let modal;
  let previousFocus = null;
  let selectedPiece = null;
  let placedCount = 0;
  let dragState = null;

  const lang = () => {
    const value = (document.documentElement.lang || 'it').toLowerCase().slice(0, 2);
    return COPY[value] ? value : 'it';
  };

  const t = () => COPY[lang()];

  function syncProfileLocale() {
    const copy = t();
    document.querySelectorAll('[data-romeo-background-label]').forEach(el => { el.textContent = copy.background; });
    document.querySelectorAll('[data-romeo-family-title]').forEach(el => { el.textContent = copy.family; });
    document.querySelectorAll('[data-romeo-family-prefix]').forEach(el => { el.textContent = copy.familyPrefix; });
    document.querySelectorAll('.romeo-trigger').forEach(el => {
      el.textContent = copy.dad;
      el.setAttribute('aria-label', copy.openLabel);
      el.setAttribute('title', copy.openLabel);
    });
  }

  function createModal() {
    if (modal) return modal;
    modal = document.createElement('div');
    modal.className = 'rg-modal';
    modal.hidden = true;
    modal.innerHTML = `
      <section class="rg-dialog" role="dialog" aria-modal="true">
        <button class="rg-close" type="button">×</button>
        <div class="rg-game">
          <div class="rg-intro"><h2 id="rg-title" aria-hidden="true"></h2></div>
          <div class="rg-board">
            <section class="rg-statement">
              <h3 class="rg-statement-title" data-copy="balanceSheet"></h3>
              <div class="rg-zones rg-bs">
                <div class="rg-zone" data-zone="assets" role="button" tabindex="0"></div>
                <div class="rg-zone" data-zone="liabilities" role="button" tabindex="0"></div>
                <div class="rg-zone" data-zone="equity" role="button" tabindex="0"></div>
              </div>
            </section>
            <section class="rg-statement">
              <h3 class="rg-statement-title" data-copy="incomeStatement"></h3>
              <div class="rg-zones rg-is">
                <div class="rg-zone" data-zone="revenue" role="button" tabindex="0"></div>
                <div class="rg-zone" data-zone="raw" role="button" tabindex="0"></div>
                <div class="rg-zone" data-zone="services" role="button" tabindex="0"></div>
                <div class="rg-zone" data-zone="staff" role="button" tabindex="0"></div>
              </div>
            </section>
            <div class="rg-tray"></div>
          </div>
        </div>
        <div class="rg-letter-stage" aria-live="polite">
          <div class="rg-envelope" aria-hidden="true">
            <div class="rg-envelope-back"></div>
            <div class="rg-envelope-flap"></div>
            <article class="rg-paper"><p class="rg-letter"></p></article>
          </div>
        </div>
      </section>`;
    document.body.appendChild(modal);

    modal.querySelector('.rg-close').addEventListener('click', closeGame);
    modal.addEventListener('pointerdown', event => { if (event.target === modal) closeGame(); });
    modal.querySelectorAll('.rg-zone').forEach(zone => {
      zone.addEventListener('click', () => { if (selectedPiece) attemptPlacement(selectedPiece, zone); });
      zone.addEventListener('keydown', event => {
        if ((event.key === 'Enter' || event.key === ' ') && selectedPiece) {
          event.preventDefault();
          attemptPlacement(selectedPiece, zone);
        }
      });
    });
    return modal;
  }

  function localizeModal() {
    const copy = t();
    const root = createModal();
    root.querySelector('.rg-close').setAttribute('aria-label', copy.closeLabel);
    root.querySelector('.rg-dialog').setAttribute('aria-label', copy.title);
    root.querySelector('#rg-title').innerHTML = BINARY_ROMEO.map(byte => `<span>${byte}</span>`).join('');
    root.querySelector('[data-copy="balanceSheet"]').textContent = copy.balanceSheet;
    root.querySelector('[data-copy="incomeStatement"]').textContent = copy.incomeStatement;
    root.querySelectorAll('.rg-zone').forEach(zone => {
      const label = copy.zones[zone.dataset.zone];
      zone.dataset.label = label;
      zone.setAttribute('aria-label', label);
    });
    root.querySelector('.rg-letter').textContent = copy.letter;
  }

  function buildPieces() {
    const tray = modal.querySelector('.rg-tray');
    tray.replaceChildren();
    placedCount = 0;
    selectedPiece = null;
    const copy = t();
    ITEMS.forEach(item => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'rg-piece';
      button.dataset.item = item.id;
      button.dataset.zone = item.zone;
      button.setAttribute('aria-label', copy.items[item.id]);
      button.setAttribute('title', copy.items[item.id]);
      button.innerHTML = SVG[item.id];
      button.addEventListener('click', event => {
        if (dragState?.moved) return;
        selectPiece(button);
        event.stopPropagation();
      });
      button.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          selectPiece(button);
        }
      });
      if (!window.matchMedia('(pointer: coarse)').matches) button.addEventListener('pointerdown', startDrag);
      tray.appendChild(button);
    });
  }

  function selectPiece(piece) {
    if (piece.closest('.rg-zone')) return;
    if (selectedPiece === piece) {
      piece.classList.remove('is-selected');
      selectedPiece = null;
      return;
    }
    modal.querySelectorAll('.rg-piece.is-selected').forEach(el => el.classList.remove('is-selected'));
    selectedPiece = piece;
    piece.classList.add('is-selected');
  }

  function attemptPlacement(piece, zone) {
    if (!piece || !zone || piece.closest('.rg-zone')) return;
    if (piece.dataset.zone !== zone.dataset.zone) {
      zone.classList.remove('is-wrong');
      void zone.offsetWidth;
      zone.classList.add('is-wrong');
      window.setTimeout(() => zone.classList.remove('is-wrong'), 360);
      return;
    }
    piece.classList.remove('is-selected', 'is-drag-source');
    piece.removeEventListener('pointerdown', startDrag);
    piece.tabIndex = -1;
    zone.appendChild(piece);
    selectedPiece = null;
    placedCount += 1;
    if (placedCount === ITEMS.length) window.setTimeout(revealLetter, 650);
  }

  function startDrag(event) {
    if (event.button !== undefined && event.button !== 0) return;
    const piece = event.currentTarget;
    if (piece.closest('.rg-zone')) return;
    dragState = { piece, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false, ghost: null, target: null };
    piece.setPointerCapture?.(event.pointerId);
    piece.addEventListener('pointermove', moveDrag);
    piece.addEventListener('pointerup', endDrag);
    piece.addEventListener('pointercancel', endDrag);
  }

  function moveDrag(event) {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    const distance = Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY);
    if (!dragState.moved && distance < 8) return;
    event.preventDefault();
    if (!dragState.moved) {
      dragState.moved = true;
      dragState.ghost = dragState.piece.cloneNode(true);
      dragState.ghost.classList.add('rg-drag-ghost');
      dragState.ghost.removeAttribute('id');
      document.body.appendChild(dragState.ghost);
      dragState.piece.classList.add('is-drag-source');
    }
    dragState.ghost.style.left = `${event.clientX}px`;
    dragState.ghost.style.top = `${event.clientY}px`;
    const hit = document.elementFromPoint(event.clientX, event.clientY);
    const zone = hit?.closest?.('.rg-zone') || null;
    if (dragState.target !== zone) {
      dragState.target?.classList.remove('is-target');
      zone?.classList.add('is-target');
      dragState.target = zone;
    }
  }

  function endDrag(event) {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    const state = dragState;
    dragState = null;
    state.piece.removeEventListener('pointermove', moveDrag);
    state.piece.removeEventListener('pointerup', endDrag);
    state.piece.removeEventListener('pointercancel', endDrag);
    state.piece.releasePointerCapture?.(event.pointerId);
    state.target?.classList.remove('is-target');
    state.ghost?.remove();
    state.piece.classList.remove('is-drag-source');
    if (state.moved && state.target) attemptPlacement(state.piece, state.target);
    window.setTimeout(() => { if (dragState === null) state.moved = false; }, 0);
  }

  function revealLetter() {
    const dialog = modal.querySelector('.rg-dialog');
    dialog.scrollTop = 0;
    modal.querySelector('.rg-board').classList.add('is-complete');
    modal.querySelector('.rg-intro').setAttribute('aria-hidden', 'true');
    const stage = modal.querySelector('.rg-letter-stage');
    stage.classList.add('is-visible');
    stage.querySelector('.rg-envelope').setAttribute('aria-hidden', 'false');
    window.setTimeout(() => stage.querySelector('.rg-paper').focus?.(), 1800);
  }

  function resetGame() {
    const board = modal.querySelector('.rg-board');
    const stage = modal.querySelector('.rg-letter-stage');
    board.classList.remove('is-complete');
    modal.querySelector('.rg-intro').removeAttribute('aria-hidden');
    stage.classList.remove('is-visible');
    stage.querySelector('.rg-envelope').setAttribute('aria-hidden', 'true');
    modal.querySelectorAll('.rg-zone').forEach(zone => zone.replaceChildren());
    buildPieces();
  }

  function openGame() {
    localizeModal();
    resetGame();
    previousFocus = document.activeElement;
    modal.hidden = false;
    document.body.classList.add('romeo-game-open');
    requestAnimationFrame(() => {
      modal.classList.add('is-open');
      modal.querySelector('.rg-close').focus({ preventScroll: true });
    });
  }

  function closeGame() {
    if (!modal || modal.hidden) return;
    modal.classList.remove('is-open');
    document.body.classList.remove('romeo-game-open');
    window.setTimeout(() => {
      modal.hidden = true;
      resetGame();
      previousFocus?.focus?.({ preventScroll: true });
    }, 290);
  }

  function trapKeys(event) {
    if (!modal || modal.hidden) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeGame();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...modal.querySelectorAll('button:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(el => !el.closest('[aria-hidden="true"]'));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  function init() {
    syncProfileLocale();
    createModal();
    document.addEventListener('click', event => {
      const trigger = event.target.closest('.romeo-trigger');
      if (!trigger) return;
      event.preventDefault();
      openGame();
    });
    document.addEventListener('keydown', trapKeys);
    document.querySelectorAll('[data-lang]').forEach(control => {
      control.addEventListener('click', () => window.setTimeout(() => {
        syncProfileLocale();
        if (modal && !modal.hidden) localizeModal();
      }, 0));
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
