# Deploy v6.15.4

Il pacchetto è un overlay incrementale. Deve essere copiato sopra il repository esistente senza eliminare altri file e senza rimuovere la cartella `.git`.

## Procedura

1. Verificare che il repository locale sia aggiornato e senza modifiche non salvate.
2. Estrarre `tax-automation-lab-v6.15.4-overlay.zip` in una cartella temporanea.
3. Copiare tutto il contenuto estratto nella root del repository, accettando la sostituzione dei file omonimi.
4. Controllare con `git status` i file modificati.
5. Eseguire commit e push.
6. Attendere il completamento di GitHub Pages.
7. In Cloudflare eseguire **Purge Everything**.
8. Verificare il sito in finestra anonima.

## Smoke test post-deploy

- Aprire **Configura con AI** e verificare la presenza dei quattro riquadri, incluso Analisi di bilancio, e dei relativi screenshot.
- Scaricare entrambi i template Excel.
- Nel tool Analisi di bilancio verificare la presenza permanente della voce Dashboard nella sidebar.
- Importare un bilancio ante chiusura in cui la differenza SP coincide con il risultato CE: l’import deve riuscire con proposta `TAL_AIX`.
- Confermare la voce tecnica e verificare che gli export si sblocchino.
- Importare un bilancio post chiusura con una voce A.IX originaria: non deve essere creata una seconda voce.
- Importare un bilancio non riconciliato: nessuna voce tecnica deve essere creata e gli export devono restare bloccati.

## Commit suggerito

Titolo:

`Release v6.15.4 – Add controlled year-end result reconciliation`

Descrizione:

- Added pre-closing and post-closing balance detection
- Added controlled A.IX technical result reconstruction
- Preserved all original ERP rows and account granularity
- Allowed supported pre-closing imports with professional confirmation
- Blocked final exports until the technical result is confirmed
- Prevented forced balancing where SP and CE do not reconcile
- Improved numeric Excel parsing in Financial Statement
- Updated Financial Analysis to v2.0.4
- Updated Financial Statement to v1.3.3
- Updated Configura con AI prompts and templates in Italian, English and Spanish
