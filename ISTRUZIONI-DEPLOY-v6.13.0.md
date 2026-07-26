# Istruzioni di deploy — Tax Automation Lab v6.13.0

1. Esegui il backup degli archivi locali dai tool e conserva il pacchetto di produzione precedente.
2. Estrai `tax-automation-lab-site-v6.13.0-production.zip`.
3. Carica nel repository **il contenuto estratto**, mantenendo invariata la struttura di cartelle e file.
4. Controlla che il riepilogo Git mostri le nuove rotte Financial Analysis e gli aggiornamenti ai tool esistenti.
5. Crea un commit descrittivo, ad esempio: `Release v6.13.0: audit remediation and Financial Analysis`.
6. Esegui il push e attendi GitHub Actions verde.
7. Verifica il sito in produzione prima del purge Cloudflare; quindi svuota la cache e ripeti i controlli in anonimo.
8. Esegui la checklist contenuta in `POST-DEPLOY-ACTIONS.md`.
9. Crea la release GitHub usando esclusivamente il pacchetto asset dedicato al Financial Statement.

In caso di regressione bloccante, ripristina il commit precedente e la relativa versione del sito. Non tentare correzioni direttamente sui file già pubblicati senza creare una nuova versione tracciabile.
