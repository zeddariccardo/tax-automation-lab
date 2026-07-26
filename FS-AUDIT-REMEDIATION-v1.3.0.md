# Financial Statement v1.3.0 — recepimento audit indipendente

## Esito dell’audit di origine

L’audit ha confermato la correttezza delle quadrature aritmetiche del caso completo, ma ha considerato la v1.2.0 non pubblicabile senza correzioni su schema civilistico, sicurezza delle importazioni e persistenza.

## Correzioni implementate

- completate le voci mancanti dello schema ordinario dell’art. 2424 c.c.;
- introdotte sottovoci di scadenza entro/oltre per crediti finanziari, crediti dell’attivo circolante e debiti;
- migrazione compatibile dei mapping storici, con avviso esplicito sui codici convertiti;
- blocco delle formule Excel senza valore cached, evitando import silenziosi a zero;
- rendering sicuro dei mapping salvati e import JSON con validazione stretta;
- controllo sul cambio di identità societaria per impedire il riutilizzo involontario dei conti della società precedente;
- esito reale dei salvataggi localStorage, con stato accessibile e messaggi di errore;
- miglioramenti di tastiera, tab e modali.

## Regola di migrazione

I codici storici senza distinzione temporale vengono migrati prudenzialmente: crediti finanziari verso “oltre”, crediti circolanti e debiti verso “entro”. La scelta viene segnalata e deve essere validata dal professionista.

## Limiti residui

La completezza normativa e la classificazione dei singoli conti richiedono sempre validazione professionale. PDF, accessibilità e comportamento responsive sono verificati nel pacchetto, ma non sostituiscono una review su dispositivi e lettori assistivi reali.
