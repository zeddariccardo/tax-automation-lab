# LIPE v3.4.0 — recepimento audit indipendente

## Esito dell’audit di origine

L’audit ha confermato i calcoli VP del caso completo, ma ha individuato difetti bloccanti nella produzione XML, nella codifica del quarto trimestre, nei riporti e nella persistenza.

## Correzioni implementate

- XML IVP18 con campi opzionali emessi soltanto quando ammessi e valorizzati;
- IVA dovuta e IVA a credito mutuamente esclusivi;
- codice trimestre 5 per il quarto trimestre dei trimestrali per opzione, in XML e PDF;
- cambio periodo isolato in una nuova lavorazione, senza trascinamento silenzioso delle righe;
- import legato a cliente, anno, periodo e regime;
- riporti automatici ammessi soltanto da storico precedente finalizzato, coerente e non obsoleto;
- parser numerici, percentuali e date più restrittivi;
- rifiuto dei duplicati nel codiciario IVA;
- cancellazione del cliente estesa a lavorazioni, manuali e storico;
- storico senza taglio globale a 100 record;
- backup e ripristino completo con checksum;
- errori localStorage resi visibili.

## Gate di rilascio fiscale

La validazione strutturale XML interna non equivale al controllo ufficiale dell’Agenzia delle Entrate. Prima dell’invio telematico restano necessari il controllo con i moduli ufficiali e la review del professionista responsabile.
