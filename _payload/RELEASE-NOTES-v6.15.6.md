# Tax Automation Lab v6.15.6

## Correzione critica — export Excel dell’Analisi di bilancio

- Aggiornato il Financial Analysis Tool alla versione **2.0.5**.
- Corretto il download del report XLSX quando `XLSX.write()` restituisce un `Array` o un altro tipo binario dipendente dal browser.
- Il payload viene ora normalizzato in `Uint8Array` prima della creazione del `Blob`, evitando la conversione testuale dei byte (`80,75,3,4,...`).
- Aggiunta la verifica della firma ZIP `PK\x03\x04` e, quando JSZip è disponibile, della presenza di `[Content_Types].xml` e `xl/workbook.xml`.
- Il download viene bloccato con un messaggio esplicito qualora il pacchetto non sia un XLSX valido.
- Allineata a v2.0.5 l’indicazione di versione nei report generati.
- Nessuna modifica ai calcoli, ai KPI, alle riclassificazioni, al mapping, all’importazione o ai dati salvati localmente.

La correzione è applicata alle copie italiana, inglese e spagnola del tool.
