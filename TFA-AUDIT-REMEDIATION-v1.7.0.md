# TFA Client File v1.7.0 — remediation dell’audit

## Confermati e corretti

- Il salvataggio non dichiara più successo quando `localStorage` rifiuta il dato.
- Le azioni distruttive proteggono il lavoro non archiviato.
- Esportazione e ripristino dell’intero archivio, con anteprima e conflitti.
- Identificativo cliente stabile e indipendente da CF/P.IVA.
- Validazione del periodo d’imposta e parsing robusto degli importi.
- Conferme per osservazioni e blocchi Commentary aggiuntivi.
- Badge permanente draft/archivio e indicatore dello spazio browser.
- Una sola barra comandi, etichette export dinamiche, checklist e ricerca globale.
- `id`/`for` nei campi dinamici e toggle utilizzabili da tastiera.
- Undo mirato per le azioni distruttive e feedback persistente per gli errori.
- Nome del template personalizzato con cliente e anno.

## Decisioni deliberate

- Il primo salvataggio nell’archivio resta esplicito: il draft automatico non viene confuso con l’archiviazione professionale.
- L’undo non registra ogni singolo tasto, ma protegge le operazioni strutturali e distruttive.
- Non è stata introdotta in questa release la visualizzazione mobile dei soli campi compilati, perché richiede una riprogettazione dedicata delle schede.
- Il codice legacy `compactExportPlan` non è stato rimosso: la rimozione sarà parte di un refactoring separato, senza impatto funzionale.
