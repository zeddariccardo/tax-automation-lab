# Deploy v6.15.2

Il file ZIP è un overlay incrementale.

1. Estrarre il pacchetto.
2. Copiare tutto nella root del repository, sostituendo i file esistenti.
3. Non eliminare altri file e non modificare la cartella `.git`.
4. Eseguire `git status` e verificare l'elenco delle modifiche.
5. Fare commit e push.
6. Attendere il completamento di GitHub Pages.
7. Eseguire `Purge Everything` in Cloudflare.
8. Effettuare lo smoke test post-deploy indicato nelle release notes.

## Smoke test minimo

- Configura con AI: verificare la presenza di quattro riquadri e della sezione Analisi di bilancio con screenshot.
- Analisi di bilancio: importare un file, aprire un'altra sezione e tornare alla Dashboard dalla sidebar.
- Analisi di bilancio e Bilancio civilistico: provare Nuovo, annullare il popup, salvare una società, aprire Archivio e ricaricare il lavoro.
