# Tax Automation Lab — guida operativa

## Prima di lavorare

- Leggi `CONTESTO.md` e il più recente handoff pertinente.
- Per LIPE, tratta `../tax-automation-lab-backend/MIGRAZIONE_TOOL_PLAYBOOK.md` come fonte principale; consulta anche `CONTRATTO-DOM-LIPE.md` e i rapporti LIPE collegati.
- Il repository pubblico è statico (GitHub Pages). Il Worker e la logica fiscale server-side vivono nel repository privato fratello `../tax-automation-lab-backend`.
- Preserva modifiche e file non tracciati dell'utente. Non fare commit, push o pubblicazioni senza autorizzazione esplicita per quella release.

## Invarianti LIPE

- Non reintrodurre nel browser il motore fiscale e non aggiungere fallback locali.
- Mantieni un'unica richiesta per stato coerente, il payload aggregato e privo di dati identificativi, la privacy locale, le 257 fixture golden e l'impronta demo `618`.
- `window.lipeApiDiagnostica()` deve restare con `rifiuti: 0`; gli errori del servizio devono cancellare risultati obsoleti e offrire `Riprova`.
- Non modificare a mano il blocco tra `PONTE LIPE` e `fine PONTE LIPE`: è generato da `tax-automation-lab-backend/strumenti/genera-ponte-lipe.mjs`.
- Non cambiare contratto DOM, XML IVP18, nomi file, progressivi o logica telematica senza una decisione funzionale esplicita dell'utente.
- Non modificare il renderer PDF durante interventi non specificamente dedicati al PDF. Modifiche al PDF sono ammesse solo in task espliciti, con regression test dedicati e senza alterare la logica fiscale/XML.

## Verifica

- Servi sito e API insieme con `node strumenti/server-locale.mjs 4173` dal repository backend.
- Esegui almeno `npm test` in entrambi i repository e `npm run test:e2e` nel pubblico. Usa `npm run test:e2e:lipe` solo come smoke finale controllato: il runner inoltra `/api/*` alla produzione per impostazione predefinita.
- Per cambi visuali LIPE usa dati demo e Chromium/Playwright alle viewport `320x568`, `360x800`, `390x844`, `430x932`, `768x1024`, `1280x800`, `1440x900`. Controlla screenshot, focus, menu, dialoghi, stati vuoto/errore, tabelle e assenza di scroll orizzontale globale.
- I test DOM non sostituiscono il controllo visuale. Verifica il runtime attivo: definizioni successive nello stesso HTML possono sovrascrivere quelle precedenti.
- Dopo modifiche a CSS condiviso aggiorna il parametro cache-busting e ricontrolla almeno 375–390 px senza overflow orizzontale.
