/* Tax Automation Lab — metadati del catalogo strumenti.
   Nome canonico italiano, versione, URL, data e confine di elaborazione hanno
   una sola fonte autorevole: tools/manifest.json. L'HTML conserva un fallback
   statico localizzato, verificato dai test, per restare leggibile senza JS. */
(function () {
  'use strict';

  const lang = (document.documentElement.lang || 'it').toLowerCase().slice(0, 2);
  const locale = lang === 'en' ? 'en-GB' : (lang === 'es' ? 'es-ES' : 'it-IT');
  const labels = {
    it: { updated: 'Aggiornato il', local: 'elaborazione locale', service: 'calcolo su servizio con soli dati tecnici/numerici', online: 'solo online' },
    en: { updated: 'Updated', local: 'local processing', service: 'calculation service with technical/numeric data only', online: 'online only' },
    es: { updated: 'Actualizado el', local: 'procesamiento local', service: 'servicio de cálculo solo con datos técnicos/numéricos', online: 'solo en línea' }
  }[lang] || null;

  if (!labels) return;

  function formatDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
    if (!match) return '';
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
  }

  fetch('/tools/manifest.json', { cache: 'no-cache', credentials: 'same-origin' })
    .then(function (response) {
      if (!response.ok) throw new Error('catalog manifest unavailable');
      return response.json();
    })
    .then(function (manifest) {
      const tools = new Map((manifest.tools || []).map(function (tool) { return [tool.slug, tool]; }));
      document.querySelectorAll('[data-tool-slug]').forEach(function (card) {
        const tool = tools.get(card.getAttribute('data-tool-slug'));
        const target = card.querySelector('[data-tool-meta]');
        if (!tool || !target) return;
        const badge = card.querySelector('.label');
        if (badge && tool.version) {
          badge.textContent = badge.textContent.replace(/\bv\d+\.\d+\.\d+\b/, 'v' + tool.version);
        }
        const title = card.querySelector('h2');
        if (lang === 'it' && title && tool.name) title.textContent = tool.name;
        try {
          const url = new URL(tool.site_url);
          if (url.protocol === 'https:' && url.hostname === 'taxautomationlab.com') {
            card.querySelectorAll('a[href^="/tools/"]').forEach(function (link) {
              link.setAttribute('href', url.pathname + url.search + url.hash);
            });
          }
        } catch (_) { /* il fallback statico resta utilizzabile */ }
        const date = formatDate(tool.updated);
        const processing = tool.privacy_model && tool.privacy_model.processing === 'local_in_browser'
          ? labels.local : labels.service;
        target.textContent = [date ? labels.updated + ' ' + date : '', processing, labels.online].filter(Boolean).join(' · ');
      });
    })
    .catch(function () {
      /* Le schede hanno già un fallback testuale corretto e senza date inventate. */
    });
})();
