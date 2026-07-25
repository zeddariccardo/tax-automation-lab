# Financial Statement v1.2.0 — remediation dell’audit

## Confermati e corretti

- Nome del PDF corretto e arricchito con schema, anno e denominazione.
- La memoria cliente conserva il mapping, non storni, rettifiche o schema dell’esercizio precedente.
- Il comparativo assente genera un warning, non una quadratura verde.
- Gli storni tra sezioni applicano correttamente il segno della destinazione.
- Rettifiche e storni possono essere indicati separatamente per corrente e precedente.
- Schemi ordinario e abbreviato completati con le voci e i raggruppamenti necessari.
- Tolleranza di quadratura uniforme a EUR 0,01 e delta sempre visibile.
- Controllo dedicato alla convenzione dei segni.
- Colonna comparativa facoltativa e intestazione ricercata nelle prime righe del foglio.
- Segno del dettaglio calcolato sulla voce foglia effettiva.

## Decisioni deliberate

- Le due implementazioni storiche del motore non sono state eliminate in questa release: il layer v1.2.0 resta quello effettivamente utilizzato e testato; il consolidamento richiede un refactoring separato.
- Non sono stati incorporati font Unicode aggiuntivi nel PDF monofile; la gestione dei caratteri non latini resta un miglioramento futuro.
- L’identificativo della memoria mapping resta collegato agli identificativi fiscali: la release elimina la riapplicazione pericolosa, mentre una migrazione a identificatore stabile sarà progettata separatamente.
- Le ottimizzazioni sulle righe di dettaglio a zero e sugli arrotondamenti di sola presentazione sono rinviate a una release editoriale.
