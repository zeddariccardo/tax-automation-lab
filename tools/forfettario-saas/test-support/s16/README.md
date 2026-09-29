# S16 — audit e polish della presentazione

Stato al 29 settembre 2026: S16 PASS. Fix locali e journey hosted contribuente/Studio
completati; limiti delle suite generali e finding separati documentati sotto.

## Perimetro

Polish approvato di testi, gerarchia visiva, CSS e focus, seguito dai tre fix hosted
espressamente autorizzati: CSP S15, revalidation della sessione, origin fiscale development.
Nessuna modifica a RLS, modello Auth, API, schema, Worker, calcoli, criteri di completezza,
parser, export o workflow. La semantica di importi mancanti/zero, stima/versamento,
bozza/invio, download/pagamento rimane esplicita.

### Correzioni

- Ingresso, onboarding e caricamenti: eliminati slogan e rassicurazioni generiche.
- Entrate: titolo e azioni senza sottotitoli duplicati; aggiunta primaria, import e
  incasso secondari; importi e residui mantengono il peso principale.
- Oggi/Tasse: stato mancante concreto; nessuna spiegazione di un pagamento inesistente;
  su mobile la richiesta azionabile precede il riepilogo del pagamento.
- Attività/Documenti: relazione con lo Studio nell'intestazione, stato di attesa sintetico,
  azione di download denominata correttamente, flusso senza spazio per avatar assenti.
- Dichiarazione: conferme professionali e dati da completare distinti, riepiloghi più brevi.
- Pagamenti: stato "Scaricato · pagamento non registrato" conservato; data leggibile
  nel pannello, JSON secondario, limite del modello di lavoro ancora visibile.
- Form: input/select/textarea, bordi, altezze e focus condivisi. Pannelli con chiusura
  sempre raggiungibile e focus ripristinato dopo aggiornamenti asincroni.
- Token: scala spazi 4/8/12/16/24/32/48, testi 12/14/16/20/24, radius 8/10/16,
  controllo 48 px. Palette TAL e font esistenti conservati.

## Strumenti locali, senza servizi

Avviare dalla radice frontend:

```sh
node tools/forfettario-saas/test-support/s16/gallery-server.mjs
```

- `http://127.0.0.1:4179/`: 22 stati sintetici dei renderer effettivi.
- `http://127.0.0.1:4179/app/`: navigazione della UI effettiva con sessione e servizi
  **simulati**, identificati in pagina. Nessun login, token, persistenza o scrittura.
- Il server sostituisce i runtime soltanto nella propria risposta di test; non cambia
  i moduli del prodotto. Ascolta su loopback e imposta CSP `connect-src 'none'`.
- Non avviare questa galleria come ambiente di integrazione. La preview reale resta
  su 4173 con i propri runtime. Il prodotto non importa questi file di test.

`states.mjs` riusa i renderer, `app-runtime.mjs` fornisce solo dati sintetici e rifiuta
le mutazioni; `gallery.mjs` presenta gli stati. Nessuna dipendenza aggiunta.

## Evidenza visuale locale

22 stati dei renderer verificati a 1440/1024/390/375: 88 controlli senza overflow.
Console osservata senza warning/errori. I risultati delle suite finali sono sotto.

Controllo visuale nel browser di accesso/registrazione, onboarding personale/Studio,
scelta profilo, attesa verifica, Oggi, Entrate, Tasse/previsione, Attività, archivio,
Da fare/Clienti/Scadenze, posizione cliente, Dichiarazione e Pagamenti.
Provati pannelli fattura/incasso, import iniziale, upload, collegamento, verifica
documento, F24 e revisione versamenti. Provati ricerca vuota, caricamento, errore,
bozza non aggiornata, importi parziali/bloccati e documenti in attesa.
L'import con mapping/anteprima finale è stato auditato nel codice; la sua interazione
completa con file e conferma cloud non è stata rieseguita in questa sessione.

Tab, Shift+Tab, Escape e Indietro verificati nei pannelli; focus visibile e ritorno
al controllo di origine verificati anche dopo il caricamento asincrono dell'F24.
Il pannello dei collegamenti mantiene il focus al proprio interno quando cambia contenuto.
Nessuna attestazione di audit completo screen reader o tastiera virtuale iOS/Android.

Contrasto misurato sui token renderizzati: testo/paper 15,77:1; secondario/paper
8,88:1; attenuato/paper 4,87:1; petrolio/bianco 8,51:1; viola/bianco 8,65:1;
errore/paper 5,84:1. Gli stati mantengono etichette testuali oltre al colore.


## Fix dei tre blocker hosted

1. **Oggi/Tasse — CORS**. OPTIONS con Origin 4173 restituiva 403; 4174 era ammessa.
   Aggiunta soltanto 4173 nella allowlist della funzione development già esistente.
   Verifica successiva: 4173/4174 -> 204 con origin esatta; origin estranea -> 403.
   JWT obbligatorio conservato. Calcolo reale nel browser 4173 riuscito.
2. **Pagamenti — CSP HTML**. Il servizio riceveva JWT e contesto corretti, ma fetch
   falliva immediatamente con TypeError prima di ricevere una risposta. La CSP del
   server locale includeva S15; la seconda CSP, nell'HTML, ometteva tal-payment-draft,
   tal_review_payments e tal_f24_action. Aggiunti esclusivamente quei tre endpoint.
   Dopo il fix: HTTP 200, workspace/anno/gruppi/revision validi, F24 visibili.
   Nessuna modifica a servizio Pagamenti, parsing, revisioni o backend S15.
   Test di regressione verifica entrambi i livelli CSP, senza wildcard generica.
3. **Sessione — revalidation**. Due difetti riprodotti deterministicamente prima del fix:
   il controllo periodico incrementava l'epoch anche a identità/contesto invariati,
   facendo scartare letture ancora valide come stale; un errore 503 azzerava la UI
   pur conservando una sessione valida, spiegando il recupero tramite Riprova.
   La causa di rete/provider della singola intermittenza storica non è stata registrata:
   non viene attribuita senza prova a Supabase. Corretto il trattamento client.
   Ora il controllo periodico non cambia epoch salvo effettivo cambio identità/scope.
   Errori di rete/5xx/429 conservano la vista già verificata solo con token non scaduto.
   Nessun permesso deriva da questa vista: ogni operazione continua a usare JWT e RLS.
   Token scaduto + rete indisponibile -> dati nascosti e credenziali conservate per retry;
   refresh rifiutato -> sessione chiusa. Risposte malformate, revoca e cambio contesto
   restano fail-closed. Logout/cambio profilo impediscono ogni risposta tardiva.

La diagnostica temporanea registrava soltanto endpoint, status e booleani di validazione;
è stata rimossa. Nessun token, password o payload fiscale è stato scritto nei log.

## Risultati dopo i fix

- Suite SaaS: 180/180 PASS, di cui Auth 29/29; test CSP Pagamenti incluso.
- Auth/context hosted: 18/18 PASS, sei login/discovery, refresh e contesti separati.
- Smoke S15: 15/15 PASS, RLS negativi e stessa bozza contribuente/Studio.
- Fiscale backend/CORS: 30/30 PASS, parità S01 e dinieghi inclusi.
- Statici frontend: 310/310 PASS; responsive generale: 42/42 PASS.
- Backend generale: 644 PASS, 260 SKIP, zero fail.
- Frontend generale: 768/770 PASS; due timeout al caricamento delle pagine pubbliche
  F24 e Forfettario, entrambe fuori dalle modifiche S16. Riesecuzione Forfettario
  isolata: 24/24 PASS. Riesecuzione F24 isolata: 57/57 PASS.
  Non si trasforma la prima esecuzione generale in un 770/770 PASS.
- Le prime esecuzioni nel sandbox avevano EPERM Chromium/ownership Git; rieseguite
  nell'account Windows dell'utente senza modifiche alle suite o timeout.

Journey contribuente hosted completato: login/sessione ripristinata -> Oggi -> Entrate
-> Tasse -> Attività -> dati Dichiarazione -> Pagamenti. Oggi/Tasse mostrano 4.606,07
incassati nel 2026, riserva stimata 949; nessun fallback locale. Dichiarazione versione15.
Pagamenti versione9: PAID 225.020 centesimi, READY 113.580 centesimi, due voci da verificare.
Pannello F24 aperto in sola consultazione; nessun download che ne cambi lo stato,
nessuna riconciliazione, upload, import, fattura o versamento nuovi.

Verifiche reali a 1440/1024/390/375, incluse Tasse e Pagamenti su mobile: nessun overflow.
Pannello F24 a390 contenuto nel viewport, Tab/Escape e ritorno focus ad Apri F24 PASS.
Journey Studio hosted completato con dual-role nel contesto Studio A: Da fare ->
posizione A -> Entrate -> Riepilogo/Tasse -> Attività -> Dichiarazione -> Pagamenti.
Gli stessi importi del contribuente sono visibili nel browser: incassato 4.606,07,
riserva 949, imposta 522,41; dichiarazione versione 15 e F24 1.135,80/2.250,20.
Verificati desktop 1440, tablet 1024 e mobile 390/375 senza overflow. Pannello F24
a375 interamente nel viewport; Tab passa a Scarica F24 PDF, Escape chiude e riporta
il focus ad Apri F24. Nessun nuovo errore/warning console osservato nel journey.
La richiesta clean-path è stata aperta in consultazione, senza completarla.
Nessuna nuova fattura, versamento, conferma professionale, revoca o modifica di dati.
Il passaggio fra profili e le letture asincrone non hanno richiesto un nuovo login.

## Finding separati, non corretti in questo intervento

- Ritorno Studio da Da fare a Clienti dopo la navigazione nelle sezioni della posizione.
- Profilo personale dual-role non configurato senza cambio Studio diretto nell'onboarding.
- Reload con sessione ripristinata torna alla home, perdendo la pagina cliente.
- Scadenze Studio ancora esplicitamente demo; ricerca Clienti per nome/riferimento Studio.
- PUBLIC EMAIL SIGNUP resta DEFERRED prima del pilot; questo intervento non configura SMTP.
- Riferimenti CU nelle fixture storiche: dati sintetici legacy, non esempi standard nuovi.

Screenshot e log sono fuori Git; nessun dato reale caricato. Nessuna modifica a schema,
policy, collegamenti o dati di dominio. Unico aggiornamento hosted: CORS della Edge
fiscale development. Nessun deployment pubblico, merge frontend main o servizio paid.
