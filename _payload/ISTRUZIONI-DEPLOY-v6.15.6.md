# Deploy v6.15.6 — hotfix export XLSX

## Applicazione automatica

1. Aggiorna la cartella locale del repository con `git pull origin main`.
2. Estrai questo pacchetto in una cartella qualsiasi, fuori dal repository.
3. Avvia `APPLICA-HOTFIX-v6.15.6.bat`.
4. Incolla il percorso completo della cartella `tax-automation-lab` quando richiesto. In alternativa, trascina la cartella del repository sopra il file BAT.
5. Il programma crea una copia di sicurezza in `_backup`, modifica le tre copie del Financial Analysis Tool, aggiorna `tools/manifest.json` e genera la documentazione della release.

## Controllo e push

Dalla cartella del repository esegui:

```bash
git diff --stat
git status
git add tools/financial-analysis/index.html en/tools/financial-analysis/index.html es/tools/financial-analysis/index.html tools/manifest.json ISTRUZIONI-DEPLOY-v6.15.6.md QA-v6.15.6.json RELEASE-NOTES-v6.15.6.md SHA256SUMS-v6.15.6.txt
git commit -m "Release v6.15.6 – Fix Financial Analysis XLSX export"
git push origin main
```

## Dopo il push

1. Attendi il completamento di GitHub Pages.
2. In Cloudflare esegui **Purge Everything**.
3. Apri il sito in finestra anonima e verifica che il tool mostri la versione **2.0.5**.
4. Importa `Analisi_di_Bilancio_ON_GROUP_compilata.xlsx`.
5. Genera il report Excel e aprilo con Microsoft Excel. Non deve comparire l’errore relativo a formato o estensione non validi.

## Rollback

Avvia `RIPRISTINA-BACKUP-v6.15.6.bat`, indica lo stesso percorso del repository e controlla il diff prima di eseguire un eventuale push.
