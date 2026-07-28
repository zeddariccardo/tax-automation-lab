# Tax Automation Lab — Release v6.15.4

Data: 28 luglio 2026

## Oggetto

Gestione controllata del risultato d’esercizio nei bilanci ante chiusura, post chiusura e già riclassificati.

## Analisi di bilancio v2.0.4

- Riconosce quando lo Stato Patrimoniale non include ancora l’utile o la perdita dell’esercizio.
- Se la differenza dello Stato Patrimoniale coincide, con segno opposto, con il risultato del Conto Economico, consente l’importazione con avviso.
- Propone una riga tecnica aggiuntiva `TAL_AIX`, classificata in `AIX`, senza modificare né aggregare i conti ERP originari.
- Richiede la conferma professionale della riga tecnica prima degli export finali.
- Non genera alcuna riga compensativa quando Stato Patrimoniale e Conto Economico non si riconciliano.
- Il messaggio di errore indica esplicitamente differenza patrimoniale, risultato economico e mancata creazione della voce tecnica.
- Mantiene la Dashboard accessibile dalla sidebar e tutte le funzioni introdotte nelle release precedenti.

## Bilancio civilistico ITA GAAP v1.3.3

- Applica la stessa logica ante/post chiusura del tool Analisi di bilancio.
- Inserisce una posizione tecnica `TAL_AIX` soltanto quando la riconciliazione è dimostrata.
- Mostra nella scheda Verifiche la voce tecnica proposta e il pulsante di conferma.
- In caso di quadratura non riconciliata, importa i dati ma mostra un avviso esplicito e blocca gli export finali.
- Corregge la lettura degli importi Excel numerici, preservando correttamente i decimali.
- Usa una tolleranza di quadratura proporzionata ai valori, con minimo di 0,01 euro.

## Configura con AI e template

- Aggiornati i prompt di Financial Statement e Analisi di bilancio nelle pagine IT, EN ed ES.
- Aggiornati entrambi i template Excel.
- I prompt distinguono le righe ERP originarie dalla riga tecnica aggiuntiva `TAL_AIX`.
- Tutte le righe originarie devono essere conservate 1:1; `TAL_AIX` è l’unica riga tecnica aggiuntiva ammessa per la riconciliazione del risultato.
- Vietata qualsiasi quadratura forzata non supportata dalla corrispondenza tra differenza SP e risultato CE.

## Compatibilità e dati

- Elaborazione interamente locale nel browser.
- Nessun file trasmesso o conservato su server applicativi.
- Le sessioni archiviate restano associate al browser e al dispositivo utilizzato.
