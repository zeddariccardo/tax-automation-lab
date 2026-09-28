# S13 — importazione e migrazione reale

S13 completato con dati sintetici. Branch `feature/s07-saas-integration`, base
`b2429f31458ef7a18268adfd2610653bdc17e82c`. Le sezioni successive sono storiche.

- Entrate: **Aggiungi fattura** resta primaria; **Importa** secondaria. Backup TAL,
  PracticeTransfer, backup Studio, FatturaPA XML, CSV e XLSX sono letti localmente.
  Foglio/mapping quando necessari, preview e conferma prima di qualsiasi scrittura.
  L'originale locale non viene alterato; nessuna AI, OCR o nuova libreria.
- I parser sono estratti in modo riproducibile dal Forfettario congelato.
  `node tools/forfettario-saas/build-import-legacy.mjs --check` ne verifica l'identità.
  Il vecchio tool, homepage, menu e sitemap restano invariati.
- Prima dell'onboarding: **Hai già usato TAL? Importa i tuoi dati** permette di
  preservare un ID TAL legacy canonico. Un ID cloud diverso resta un conflitto.
- Studio: import atomico su clienti già collegati e autorizzati. Nessun lookup
  globale per ID TAL. Un cliente fuori perimetro blocca l'intero batch.
- `tal-data-service` delega a `import-service`: nessun fetch nelle view.
  Retry con la stessa chiave/payload, snapshot consistente, conflitti espliciti,
  risposte tardive scartate dopo chiusura/logout/cambio contesto.
- Note di credito e rimborsi sono operativi e distinti: una nota non genera cassa.
  Entrate e adapter fiscale leggono lo stesso grafo cloud. Worker fiscale invariato.
- Previdenza legacy ambigua conservata con originale/provenienza e “da verificare”.
  Nessuna conversione inventata, né nuovo modello previdenziale prima di S12.
- I checksum legacy restano compatibili. I nuovi hash dei binding e della
  provenienza XML usano SHA-256 standard; vedere il README backend S13 per il limite
  dell'helper di fingerprint storico, scoperto durante il confronto.

Verifiche: **143/143** test SaaS locali (20 import/lifecycle), **310/310** statici,
**42/42** responsive; hosted S13 **30/30**, S01 **15/15**, regressioni S02/S09/S13
**65/65**. Browser reale: selettore file, XML/CSV, XLSX su due clienti con scelta
foglio, mapping, commit, reload, reimport senza duplicati; mobile 390/375 senza
overflow, nessun errore console non gestito. Tastiera mobile nativa non verificata.
Suite generale frontend: 769 PASS e un timeout, passato al retry isolato; non è
una singola esecuzione tutta verde. Backend generale: 644 PASS, 260 SKIP, zero FAIL.

Configurazione development locale ignorata; nessuna credenziale nel repository.
Nessun merge su main o deployment pubblico. Preview locale: porta 4174.
**PUBLIC EMAIL SIGNUP resta DEFERRED**: la delivery pubblica della conferma email
non è stata verificata; è obbligatoria prima del pilot.

# S11 — registrazione e collegamento reali (storico)

**S11 CORE: PASS · PUBLIC EMAIL SIGNUP: DEFERRED.**

Base frontend `6e40eb3579b65caf6670f88aa7a181dfa33bebcc`, branch
`feature/s07-saas-integration`. Le sezioni successive sono storiche.
Accedi/Registrati, scelta Forfettario/Commercialista, onboarding minimo, primo accesso
e invito/accettazione/revoca usano servizi reali. Nessun bypass development nella UI.

Il normale signup richiede verifica email. UI e provisioning dopo conferma sono
testati; **signup pubblico → email ricevuta → click conferma non è verificato hosted**.
Il development usa SMTP predefinito Supabase. Due identità .test sono state create
non confermate e poi confermate solo dal test harness amministrativo autorizzato.
Questo non prova la delivery pubblica: SMTP adatto e test completo restano obbligatori
prima del pilot/go-to-market. Nessun provider SMTP configurato in S11.

- Provisioning atomico/idempotente: Account, posizione, ID TAL canonico, annualità;
  oppure Studio/owner. Studio inizialmente non verificato, senza clienti/accessi.
  Verifica manuale development testata, nessun KYC automatico.
- Minimo fiscale: data inizio, anno, più ATECO. Resolver TAL esistente via helper Edge
  autenticato; mapping ambiguo resta irrisolto. Non deduciamo previdenza/aliquota/
  requisiti e non imponiamo una previdenza per posizione. Configurazione dopo S12.
- Oggi iniziale invita a registrare la prima fattura; Studio invita il primo cliente.
  Le eventuali richieste restano visibili anche per un nuovo contribuente.
- Attività → Il tuo commercialista; Clienti → Invita cliente. Destinatario già
  registrato/configurato, codice monouso manuale, 72 ore, consenso, uno Studio,
  revoca/reinvito. Nessuna email automatica; token in memoria, mai URL/storage browser.
  Anteprima destinatario con Studio e ID TAL, niente dati fiscali prima del consenso.
- onboarding-service delegato da tal-data-service, niente fetch nelle view.
  Retry conserva chiave/payload; logout/cambio contesto scarta risposte tardive.
  Solo publishable key e JWT utente; config.local.js sempre ignorato.
- Edge development tal-resolve-activity inoltra solo anno/codice al Worker esistente.
  Nessuna modifica Worker, logica fiscale o dipendenza nuova. S07–S10 restano reali;
  la lista complessiva Scadenze dello Studio resta demo dichiarata.

Verifiche: frontend **123/123**, statici **310/310**; S11 SQL locale PASS,
setup Auth **4/4**, hosted CORE **36/36**, smoke finale **18/18**.
S10 read-only **18/18**, S09 **17/17**, S01 PostgreSQL **15/15**, gateway/byte/cleanup PASS.
Browser reale: onboarding, entrambi gli inviti/consensi, revoca/reinvito, reload/login;
1440/1024/390/375, focus, Escape/Indietro, nessun overflow.
Hardware e tastiera virtuale mobile non verificati.
Suite generali NON verdi: Chromium spawn EPERM (frontend 312 PASS/444 FAIL,
backend 573 PASS/73 FAIL/260 SKIP; responsive E2E bloccato). Browser verificato a parte.

Preview: node tools/forfettario-saas/serve-dev.mjs, porta 4174.
Nessun dato reale, merge frontend main o deployment pubblico.
Forfettario pubblico/homepage/menu/sitemap e file utente esterni invariati.
Dettagli SQL/setup/stato sintetico: README S11 nel backend privato.

# S10 — Collaborazione reale (storico)

Stato storico. Base frontend `15d0e995bd3ce5dbce98c4e6179b4eb8d0301671`,
branch `feature/s07-saas-integration`. Le sezioni S09–S06 sotto sono storiche.

Attività, richieste in Oggi, eccezioni in Da fare e archivio secondario leggono
Document/ActivityFeedItem reali. Auth, posizioni, Entrate e fiscalità S07–S09 restano
reali. Solo la lista complessiva Scadenze dello Studio conserva esempi dichiarati.

- Un flusso Attività: messaggi, richieste e documento contestuale; una CTA primaria.
  Il contribuente sceglie un file e lo invia. Dopo l'invio tocca allo Studio.
- Da fare mette prima le richieste azionabili, poi le attese. Apre direttamente il documento;
  completion da qualsiasi membro attivo dello Studio richiedente. La richiesta completata
  esce dalla coda e rimane nello storico condiviso. Ritorno alla coda conservato.
- Archivio secondario, senza path/hash/revisioni visibili. Upload generico distinto dalla
  risposta a una richiesta. Nessuna eliminazione nella UI S10; anche chiamando la RPC,
  l'evidenza di una richiesta completed non può essere eliminata.
- `tal-data-service` esteso con `collaboration-service`: letture paginate RLS e controllo
  finale dell'accesso, coda in batch, RPC S05, retry/idempotenza. Nessun fetch nelle view.
- Upload: reserve → POST Storage senza upsert → verifier hosted → finalize con JWT utente.
  PDF/PNG/JPEG/XML, 10 MiB, pending 1 ora. Byte/SHA/MIME verificati server-side.
  Dopo reload, la selezione dello stesso file riprende solo una reservation identica,
  ancora valida e visibile via RLS allo stesso uploader/contesto. Nessuna proroga.
- Esito incerto: file/payload/chiavi rimangono in memoria; retry senza duplicati. Nessun
  file o dato operativo persistito nel browser. Configurazione reale locale ignorata.
- Download solo via `tal-download-document`, JWT e contesto, size/MIME/SHA verificati,
  Blob temporaneo poi revocato. Il gateway rivaluta RLS prima/dopo i byte. Niente signed URL.
  Il primo documento pre-005 resta una fixture sintetica legacy, non il modello futuro.
- Il controller elimina dati dopo diniego/logout/cambio contesto e scarta risposte tardive.
  Refresh al ritorno/focus e ogni 30 secondi, senza Realtime. Bozza messaggio preservata durante
  normali refresh. Nessuna lettura o esposizione di note private Studio in Attività.

Preview: `node tools/forfettario-saas/serve-dev.mjs`, loopback 127.0.0.1:4174.
CSP limitata ai percorsi approvati. Header PostgREST soltanto sulle letture REST, non sulle
Edge: CORS esplicito, nessun ampliamento. Backend S10 contiene migration/verifier/test hosted.
Nessuna dipendenza nuova, secret nel browser o collegamento diretto al Worker.

Verifiche: 27 test collaborazione + 80 Auth/dati/Entrate/fiscalità/S06 = **107/107**;
statici **310/310**. Verifier **34/34**, SQL locale/hosted PASS, E2E hosted **24/24** e
smoke del servizio frontend con sei identità **18/18**. S04–S09 pertinenti PASS;
parità S01 da PostgreSQL **15/15**. Revoca link/membership con stesso JWT: diniego immediato.
Browser reale: richiesta Studio → file chooser/upload 390 px → resume/reload → documento
contestuale → messaggio → completion da altro membro → uscita Da fare. Verificati
1440/1024/390/375, focus/Back/pannelli, nessun overflow o errore console non gestito/404 finale.
Non è una verifica di hardware iOS/Android o della tastiera virtuale.

Suite generali tentate: Chromium esterno `spawn EPERM` (frontend 312 PASS/444 FAIL;
backend 573 PASS/73 FAIL/260 SKIP; responsive.e2e bloccato). Non dichiarate verdi;
la prova UI reale è stata completata separatamente nel browser desktop disponibile.

Limiti: niente antivirus/OCR/AI; controllo conservativo del formato, non garanzia di innocuità.
Hardening pre-pilot e cleanup schedulato successivi; nessun cron aggiunto. Un file già
scaricato non è ritirabile: la revoca blocca le richieste successive.
Nessun dato reale. Nessuna modifica a Forfettario pubblico, homepage, menu, sitemap o Worker.
File utente esterni preservati. Checkpoint sul branch feature, niente merge/deployment pubblico.

# S09 — Oggi e Tasse reali (storico)

Resoconto storico S09; lo stato corrente è descritto in S10 sopra.
Base frontend 3bca0cacc26b4e0e9e872c0bb1efb8ceb00bd3cc, branch feature/s07-saas-integration.
Backend base 2011e2fcff01aa48ff2439d87d4e937a53985538 piu gli artefatti S09 approvati.

- Oggi/Tasse ricevono incassato, reddito, imposta, previdenza, contributi dedotti,
  riserva, saldo/acconti/calendario e forecast da cloud → Edge autenticata → Worker.
  Browser invia soltanto workspace/anno, mai un payload fiscale arbitrario.
- tal-data-service esteso con calculateFiscal e recordPension. Le view non fanno fetch.
  Nessun nuovo motore o fallback fiscale nel browser, nessun risultato persistito.
- Contributi pagati: non indicato resta mancante; nessun versamento e uno zero
  dichiarato; i versamenti registrati sono condivisi con lo Studio autorizzato.
  Form semplice: data/importo; gestione non inventata. Audit e idempotenza server.
- Il calcolo precedente scompare prima di una scrittura/nuova lettura e in caso di
  errore, revoca, cambio posizione, logout o risposta tardiva. 409/429/503 recuperabili.
- Situazione e previsione restano separate; riserva e prossimo pagamento non sommati.
  Importi non determinabili mostrati come Da definire. Limiti del calendario Worker
  conservati. Nessun F24 o pagamento automatico.
- Auth, contesti, strutture, Entrate e fiscalita sono reali. Attivita/Documenti e
  lista Scadenze complessiva dello Studio sono ancora demo, esplicitamente indicate.
- Profilo/requisiti/ATECO/forecast cloud sintetici predisposti dal test; nessun form
  nuovo per modificarli. Supporto annualita 2025/2026. Nessun dato reale.

Verifiche S09: frontend fiscale 14/14; Auth 20/20, lifecycle 20/20, Entrate 17/17,
S06 9/9; statici 310/310; backend fiscale 29/29, S01 15/15 anche da PostgreSQL;
E2E hosted 28/28, smoke finale 17/17, Auth hosted 18/18, strutture hosted 21/21.
Atteso del test strutturale A aggiornato al seed S09 esplicito, B/dual incompleti.
Revoca stesso JWT: nuova lettura/calcolo/scrittura Studio negati, owner disponibile;
link ripristinato. Worker e RLS precedenti invariati. Nessuna chiave privilegiata in UI.
Browser reale: Studio/owner, Oggi/Tasse, previsione, versamento 10,02 da mobile,
reload (110,03 totale contributi, 4.606,07 incassato); 1440/1024/390/375 senza overflow.
Focus e pannello nel viewport verificati; nessun errore console non gestito/404 finale.
Suite generali browser preesistenti tentate ma bloccate da Chromium spawn EPERM;
non sono dichiarate verdi. Nessuna prova su tastiera virtuale/hardware mobile.

Esecuzione locale: node --test tools/forfettario-saas/fiscal.test.mjs insieme alle
suite Auth/dati/Entrate/preview. Preview su 127.0.0.1:4174 con serve-dev.mjs.
CSP limitata agli endpoint approvati, incluso il solo gateway fiscale e la RPC
previdenziale; nessun accesso UI diretto a Worker, Document, Activity o Storage.
config.local.js ignorato; nessun valore reale in config.example.js.
Checkpoint solo feature, nessun merge main/deployment pubblico. Backend S09 documenta
migration, bundle Edge development, seed, limiti e riproduzione test.

---
# S08 — Entrate cloud

Base frontend: `77c0febac5599a9ef9f75e9547f153dfbb3db612`, branch
`feature/s07-saas-integration`. Backend: base
`7e7542eda74de8a7e326395fa24fe4253a4cdfca` più migration incrementale S08
`202609270003_s08_rpc_conflict.sql`. Nessun deployment o merge frontend main.

Questa sezione descrive lo stato corrente. I resoconti S07/S06 sotto sono storici:
le loro indicazioni di dati demo, assenza di servizi o blocchi non sostituiscono S08.

## Contratto operativo

- Entrate legge Invoice, InvoiceComponent, Payment, Allocation ed EconomicActivity
  tramite `tal-data-service`. Verifica scope e data_revision prima/dopo la lettura;
  scarta risultati tardivi al cambio di identità/contesto o alla revoca.
- Il contribuente registra una fattura già emessa e incassi totali/parziali.
  Ogni incasso crea davvero Payment/Allocation via RPC, senza flag “Incassata”.
  Studio A autorizzato lavora sugli stessi record con le stesse operazioni.
- Parsing, somme e formattazione monetaria in centesimi interi, senza moltiplicare
  floating point. Cash e settlement rimangono distinti; null non diventa zero.
  Gli incassi annuali seguono cashDate; il residuo comprende tutte le fatture.
- Le scritture passano soltanto da tal_create_invoice e tal_record_payment.
  Chiave e payload sono congelati per il retry dopo risposta persa; doppio
  submit in corso deduplicato. Nessun retry automatico cieco.
- HTTP 409 aggiorna i dati e conserva i campi, richiedendo una nuova conferma:
  “Questi dati sono cambiati nel frattempo. Abbiamo aggiornato la situazione:
  controlla e riprova.” Un vero 40001 PostgreSQL non diventa un falso conflitto
  applicativo. L'esito incerto mantiene la stessa chiave/payload nel form aperto.
- Oggi, riserva fiscale, tasse, previdenza, forecast, scadenze, Documenti e Attività
  restano demo separate. La UI mostra “Entrate reali · dati fiscali ancora demo”.
  Nessun Worker, calcolo fiscale locale nuovo, Storage o gateway collegato.

Il form semplice crea una componente compenso. Con più attività chiede quale
utilizzare; senza attività usa null, ammesso dal contratto finanziario, senza
inventare ATECO. I dati fiscali obbligatori saranno gestiti nel verticale fiscale.
Le fatture con componenti/incassi complessi restano consultabili; la UI non inventa
ripartizioni automatiche. Importazione disabilitata, nessun nuovo wizard.
Il retry in questo step è in memoria: non esiste una coda offline persistente.

## Verifiche del 27 settembre 2026

| Verifica | Esito |
|---|---|
| Entrate locale: centesimi, null, cross-year, consistenza letture, retry, doppio submit, revoca, isolamento lifecycle | 17/17 PASS |
| Auth locale / strutture e lifecycle / S06 | 20/20 + 20/20 + 9/9 PASS |
| Statici frontend | 310/310 PASS |
| Hosted Entrate con sei identità reali | 28/28 PASS |
| Auth/context hosted, login e discovery | 18/18, 6/6 e 6/6 PASS |
| Letture strutturali hosted senza nuove revoche | 21/21 PASS |
| Conflitto hosted | HTTP 409 in 158 ms, singola richiesta, nessuna RPC lasciata bloccata |
| Browser contribuente | Fattura, reload, parziale, saldo e dettaglio incassi persistiti; conflitto con input conservato e retry esplicito |
| Browser Studio | Stesse fatture/incassi; cliente collegato e registrazione incasso sul dataset condiviso |
| Mobile | 390/375 px: creazione, parziale, conflitto, loading, errore importo, pannelli nel viewport; controlli anche 1440/1024 |
| Browser/accessibilità | Nessun overflow, errore/warning console o 404 osservato; focus delimitato con Tab/Shift+Tab, Escape e ritorno al portafoglio |
| Ledger backend | S01 15/15 tramite adapter PostgreSQL; regressioni S04/S05/S07 e patch S08 PASS |

Il test hosted ha perso intenzionalmente la risposta dopo il commit di un
pagamento: il retry restituisce la ricevuta originale senza duplicare righe.
B, Studio B, anon, contesti forzati e scritture dirette negati. La revoca del link
con lo stesso JWT nega subito lettura e comando; link ripristinato active,
revisione 17 → 18 → 19. Nessuna chiave privilegiata dimostra RLS.

La verifica mobile è eseguita nel browser renderizzato, non su hardware
iOS/Android o con tastiera virtuale. Durante una sessione lunga si è osservata
indisponibilità transitoria della verifica Auth: schermata di recupero,
nessun dato esposto e ripresa tramite Riprova. Non si certifica la suite generale
preesistente bloccata dall'avvio Chromium EPERM; è separata dai test qui elencati.

Le fixture finanziarie sono tutte marcate S08/SYNTHETIC. Le due fatture iniziali
da 120.001 centesimi sono state riutilizzate e saldate, senza cancellarle.
Stato finale: 5 fatture/5 componenti, 10 pagamenti/10 allocazioni, 15 ricevute
idempotenti e 15 eventi audit finanziari. Totale fatture/incassato 360.604
centesimi, residuo zero. Data revision 15, link Studio attivo revisione 19.
La fattura mobile da 301 verifica anche il conflitto tra due utenti: dopo 102
incassati, il contribuente registra 99 mentre il form Studio è già aperto.
Il tentativo Studio obsoleto è respinto; il form conserva 199 ma mostra il
nuovo residuo di 100. Solo la correzione/conferma esplicita registra gli ultimi 100.
Nessun dato reale, utente Auth, documento o oggetto Storage aggiunto.
I dati S04/S05 e le policy sono preservati; il solo cambio backend riguarda i
RAISE applicativi delle sette RPC interessate, non i loro grant o il dominio.

## Esecuzione dei test

```powershell
node --test tools/forfettario-saas/income.test.mjs tools/forfettario-saas/auth-context.test.mjs tools/forfettario-saas/tal-data.test.mjs tools/forfettario-saas/preview.test.mjs
node tests/run-test-group.mjs static
```

`income-hosted-smoke.mjs --dynamic` è un test sintetico con scritture, non una
suite da eseguire indiscriminatamente: richiede configurazione locale ignorata
e password via stdin dal Credential Manager. Il processo applicativo usa solo
publishable key + JWT. Un orchestratore separato autorizzato risponde al protocollo
REVOKE/RESTORE per la sola revoca/ripristino amministrativa, con cleanup in finally.
Nessuna password/token viene stampata o salvata dal runner.

`config.local.js` resta ignorato. Nessun secret/configurazione reale, PDF,
screenshot o log di sessione entra nel checkpoint. Forfettario pubblico,
homepage/menu/sitemap, Worker e modifiche preesistenti dell'utente sono preservati.

# S07 Step 3 — strutture cloud in sola lettura

Base frontend: `7040e3c2a3d47e8ca6b57e18b010c7e22d3d57f7`, branch
`feature/s07-saas-integration`. Backend invariato a
`b587962f7f106140c9968e8d5dc16d656b06f911`. Checkpoint limitato al frontend
sul branch feature; nessun merge su main o deployment.

## Dati effettivamente collegati

Auth e i collegamenti Account TAL / TaxWorkspace / Studio sono reali:
l'identità Account è risolta dal backend tramite la discovery autenticata.
TaxWorkspace, annualità, attività economiche e portafoglio Studio sono letti dal cloud.
Fatture, incassi, tasse, previdenza, forecast, scadenze, Document e Attività
restano invece fixture demo locali.

`tal-data-service.js` legge soltanto sei tabelle via GET, con publishable key,
JWT utente, `Accept-Profile: tal` e `x-tal-context` derivato dalla discovery.
Nessun UUID di fixture nel codice applicativo; nessun privilegio amministrativo nelle letture.

| Tabella | Proiezione utile alla UI |
|---|---|
| TaxWorkspace | UUID, etichetta identity.label, identity.startDate opzionale, stato |
| TaxYear | UUID, workspace, anno; mai facts fiscali |
| EconomicActivity | UUID, workspace, facts.atecoCode; mai parametri di calcolo |
| Studio | UUID, nome, stato verified |
| StudioClientLink | ID/scope e status active; mai token_hash |
| StudioClientPrivate | solo alias.clientCode come riferimento dello Studio; nessuna nota/facts completa |

Il seed attuale ha tre etichette SYNTHETIC, un'annualità 2026 per A, nessuna
attività economica, data di avvio o alias valorizzati. Nessun nome personale affidabile
e nessun ID TAL globale canonico: non sono generati o dedotti. Un eventuale clientCode
importato è un riferimento privato dello Studio, non un identificativo globale o un grant.
La definizione dell'ID TAL globale canonico resta una decisione successiva di
dominio/backend: il frontend non lo inventa né lo ricava da altri identificativi.

## Separazione e ciclo di vita

- `loadContext()` e `readPosition(id)` restituiscono strutture marcate `source: cloud`.
  Il servizio proietta solo i campi necessari, pagina con ordine stabile, gestisce
  401/403/404/rete e non conserva payload diagnostici del provider.
- `auth-context-service.withContextSession()` riusa la sessione/rotazione esistente;
  non espone token nello stato UI. La RLS resta il confine: i filtri client non
  sostituiscono i controlli server.
- `createTalDataController()` invalida letture tardive, dati e pannelli al cambio
  identità/contesto, logout o diniego. Nessuna cache cloud persistente.
  Le nuove letture avvengono all'ingresso, navigazione e alla discovery periodica/focus
  già prevista. La revoca è rilevata alla lettura successiva, non tramite Realtime.
- `tal-data-runtime.js` collega Auth e letture; le view non contengono fetch.
- Le fixture fiscali rimangono istanze separate di `demo-service`, in memoria per
  posizione e contesto. Nessun oggetto unisce implicitamente facts cloud e demo.
  Fatture, incassi, tasse, previdenza, forecast, scadenze, Document/Activity,
  messaggi e simulazioni restano locali. Nessuna lettura Storage/gateway/Worker.
- Portafoglio e intestazioni usano solo posizioni autorizzate; nessun cliente demo
  supplementare. Le attività/scadenze simulate sono etichettate come esempi.
  Il saluto è neutro; banner: **Ambiente di sviluppo · dati fiscali demo**.
- Stati: caricamento annunciato, errore con Riprova, posizione non disponibile,
  Nessun cliente collegato, Nessuna attività indicata, Nessuna annualità disponibile.
  I dati anagrafici si consultano nel pannello Dati della posizione, senza form di modifica.

La Data API applicativa effettua esclusivamente GET. I POST Auth/discovery preesistenti
servono solo per sessione/identità; non sono scritture dei dati TAL.
La CSP e il server locale ammettono solo i sei endpoint strutturali oltre ad Auth/discovery.
Configurazione pubblica reale ancora solo in `config.local.js`, escluso localmente da Git.

## Verifica Step 3 — 27 settembre 2026

- Auth locale **20/20**, S06 **9/9**, nuovi dati/ciclo di vita **20/20**, statici **310/310**.
- Auth/context hosted **18/18**, login/discovery delle sei identità **6/6**.
- Dati hosted **25/25**, inclusa una revoca/ripristino amministrativa controllata;
  66 richieste del data service, tutte GET, zero scritture applicative.
- A vede soltanto A (2026); B soltanto B (senza annualità); admin/member Studio A
  vedono soltanto A; Studio B nessun cliente. Dual-role: propria posizione personale
  oppure A nel contesto Studio; mai sommate.
- UUID altrui, Studio forzato, contesto errato e JWT assente: negati dalle RLS reali.
- Revoca con **JWT identico**: cliente assente alla lettura successiva e UUID noto
  negato. Ripristino verificato. Link active, revisione **13 → 14 → 15**;
  workspace revision **9 → 10 → 11**, auth_epoch **8 → 9 → 10**.
  Sono cambiati soltanto questi metadati di revoca/ripristino e i timestamp server.
  Nessuna modifica a schema/RLS, membership, documenti o dati fiscali.
- Browser reale: A, B, Studio B e dual-role personale/Studio; portafoglio A, profilo,
  annualità/attività vuote, ritorno, focus/Tab/Escape. Viewport 1440/1024/390/375,
  nessun overflow o errore console non gestito; risorse locali tutte HTTP 200.
  Errori/retry e risposte tardive verificati nei test locali; non simulata una rete mobile fisica.

Ripetizione per il checkpoint: Auth locale **20/20**, dati/lifecycle **20/20**,
S06 **9/9**, statici **310/310**, Auth hosted **18/18** e dati hosted **25/25**,
login/discovery **6/6**. Tutte le 66 richieste del data service sono GET.
La prova dinamica ha lasciato il link nuovamente active: revisione **15 → 16 → 17**,
workspace revision **11 → 12 → 13**, auth_epoch **10 → 11 → 12**.
Il dataset funzionale è ripristinato; rimangono i soli incrementi e timestamp
previsti dalla revoca/ripristino. Browser: journey contribuente/Studio,
dual-role, pannello dati, stati vuoti e logout ai quattro viewport richiesti;
nessun overflow o errore console non gestito.
Le suite generali già bloccate dall'avvio Chromium `EPERM` non sono dichiarate
verdi né attribuite a S07; non sono state rieseguite per questo checkpoint frontend.

Comandi, oltre alle verifiche Auth/S06 già descritte:

```powershell
node --test tools/forfettario-saas/tal-data.test.mjs
pwsh -File tools/forfettario-saas/run-hosted-smoke.ps1 -Suite data
```

Il secondo comando riesegue **21** prove read-only senza revoche.
`data-hosted-smoke.mjs --dynamic` è riservato all'orchestratore locale autorizzato:
mantiene la sessione durante i segnali REVOKE/REVOKED/RESTORE/RESTORED; non contiene
credenziali amministrative né SQL. Il test dinamico svolto in questo step ha usato
Windows Credential Manager e psql TLS verify-full fuori dal browser, con ripristino
in finally. Non avviarlo da solo: attende l'orchestratore.

Riferimenti: [schemi Data API](https://supabase.com/docs/guides/api/using-custom-schemas),
[proiezioni JSON](https://docs.postgrest.org/en/stable/references/api/tables_views.html#json-columns),
[paginazione](https://docs.postgrest.org/en/stable/references/api/pagination_count.html).
Nessun grant suggerito dalle guide è stato applicato.

Le sezioni seguenti sono lo storico S07 Step 2/S06: l'esclusività Auth della rete
e il portafoglio interamente mock descrivono versioni precedenti.

---

# S07 Step 2 — accesso reale, contenuti demo

Questa è la preview locale sul branch `feature/s07-saas-integration`, derivata dal checkpoint UX `50635c9ded13d2074dee47eb9093e4ba29f13cb5`. Login e scoperta contesti sono reali; tutte le viste operative S06.1 conservano esclusivamente le fixture locali. Nessuna integrazione di fatture, tasse, documenti, attività, Storage, gateway o Worker.

## Avvio locale

1. Copiare `config.example.js` in `config.local.js`; inserire soltanto URL del progetto development e publishable key. Il file locale è escluso tramite `.git/info/exclude`, senza cambiare il `.gitignore` condiviso.
2. Dalla radice frontend: `node tools/forfettario-saas/serve-dev.mjs`.
3. Aprire `http://127.0.0.1:4174/tools/forfettario-saas/`. Arrestare con Ctrl+C.

Il server ascolta solo 127.0.0.1. Serve asset locali e configurazione pubblica: non è un proxy Supabase, non riceve password e non effettua deploy. Niente nuove dipendenze.
Configurazione assente/errata: schermata esplicita, nessuna richiesta Supabase e nessun import mancante/404. Un server statico generico usa il fallback `runtime-config.js` e mostra la stessa schermata.
Il server limita CSP al progetto configurato e ai soli percorsi Auth/discovery, rifiuta redirect e non serve test, README o il file sorgente di configurazione locale.

## Confine di integrazione

- `auth-context-service.js`: login, logout, identità, refresh, restore, discovery; porte fetch/storage/lock/clock sostituibili nei test.
- `auth-runtime.js`: collega il service al browser, coordina schede tramite Web Locks e storage events, ricontrolla al focus/ritorno visibile e ogni 30 secondi mentre la pagina è visibile.
- `auth-view.js`: ingresso, attesa, errore, zero contesti, scelta contesto.
- `app.js`: autorizza la destinazione soltanto dal contesto appena scoperto; non effettua chiamate HTTP.
- `demo-service.js`: dati operativi solo in memoria; reset al logout, cambio identità/contesto o invalidazione.

Il client usa soltanto HTTP ufficiale: token password/refresh, GET user, logout con scope local, POST senza argomenti a `public.tal_list_my_contexts()`. Le chiamate discovery non inviano un contesto né ID arbitrari.
Nessuna inferenza da email/nome/ID delle fixture. Mario, Giulia e Studio Rossi restano personaggi della demo, anche quando l'account autenticato è diverso. Il menu Account identifica invece email e contesto effettivi restituiti dal servizio.

## Sessione e scelte

- Sessione in localStorage, chiave specifica per progetto: access token, refresh token, scadenza locale e UUID Auth. Nessuna password, nessun dato fiscale. Nessuna cifratura client personalizzata.
- Scelta del contesto in sessionStorage, legata all'utente, senza potere autorizzativo. A ogni restore/cambio viene confrontata con una nuova discovery. Uno Studio non più restituito non rimane selezionato.
- Reload: inizialmente solo attesa; GET user e discovery precedono qualsiasi posizione. Le fixture ripartono dallo stato iniziale.
- Un contesto: ingresso automatico. Due o più: scelta esplicita; menu Cambia contesto solo se disponibili più opzioni reali. Zero: nessun provisioning.
- Refresh entro 90 secondi dalla scadenza; Web Locks evita rotazioni simultanee fra schede della stessa origine. Ogni operazione rilegge la sessione persistita. Un token respinto da GET user ha un solo tentativo di refresh.
- Logout: chiusura della sessione corrente sul server, cancellazione sessione/preferenza/stato UI/fixture anche in caso di errore di rete. Non revoca le altre sessioni su altri dispositivi. Gli access token già emessi hanno la normale validità Supabase residua; la UI non li riutilizza.
- Errori di rete/discovery nascondono la posizione e offrono Riprova; sessione invalida torna al login. Risposte tardive non possono ripristinare una posizione dopo logout/cambio.
- La discovery decide solo l'ingresso. Non sostituisce RLS per future operazioni. Nessun permesso viene ricavato dal contesto salvato o dall'hash di navigazione.

Riferimenti ufficiali: [sessioni Auth](https://supabase.com/docs/guides/auth/sessions), [logout e scope](https://supabase.com/docs/guides/auth/signout), [API Auth](https://supabase.github.io/auth/).
L'accessibilità supporta label, autocomplete username/current-password, incolla, submit da tastiera, focus visibile e dialogo account con Escape/Tab/Indietro. Nessun signup/reset/OAuth aggiunto.

## Verifiche riproducibili

```powershell
node --test tools/forfettario-saas/preview.test.mjs
node --test tools/forfettario-saas/auth-context.test.mjs
npm run test:static
```

`run-hosted-smoke.ps1` (PowerShell 7, profilo Windows proprietario delle credenziali, Node già presente) legge soltanto i sei target `TAL-S04-auth-*` autorizzati. Passa le password una volta via stdin al processo `auth-hosted-smoke.mjs`; nessun file/token/risposta provider nei log. Il runner usa soltanto la configurazione pubblica locale e chiude le sue sessioni. Non usare credenziali reali.

- Locali Auth/context: **20/20 PASS**.
- S06: **9/9 PASS**, aggiornato solo il controllo del confine rete per consentire Auth/discovery; gli otto test funzionali conservati.
- Statici frontend: **310/310 PASS**.
- Hosted service: **18/18 PASS**, login/discovery **6/6**, identità/contesti separati, restore, refresh reale con rotazione, UUID personale/Studio altrui negati, dual-role, assenza JWT, password errata/email inesistente.
- Anche nella UI: login di tutte le sei identità, menu privo di cambio arbitrario per gli utenti con un solo contesto; chooser dual-role con due sole opzioni reali.
- Revoca temporanea del professionista Studio A: senza logout/login né refresh intenzionale, alla nuova discovery la UI ha chiuso anche il pannello account e mostrato zero contesti. Non è Realtime: il rilevamento avviene alla nuova discovery, con polling soltanto a pagina visibile. Ripristino verificato. Membership revisione **7 → 8 → 9**; Studio revisione **9 → 10 → 11**, auth_epoch **8 → 9 → 10**. Nessun link/documento/dato operativo modificato.
- Suite generali npm test frontend/backend e responsive e2e tentate: avvio Chromium bloccato da **EPERM** nell'ambiente di test. Non sono dichiarate verdi e non è stato cambiato il codice dei test per aggirarlo. Verifica UI svolta anche nel browser dell'app.


### Verifica browser finale S07

Controllo visuale e interazioni reali a 1440, 1024, 390 e 375 px: nessun overflow; login, attesa, errore, chooser, menu account e ritorno con Indietro. Tab/Shift+Tab, Invio, focus visibile, label e autocomplete verificati. Nessuna tastiera virtuale o password manager di un telefono fisico è stata emulata.
Login/discovery 6/6 anche dalla UI. Journey contribuente: fattura 900 €, incasso, richiesta e documento simulato, previsione, Oggi. Journey Studio: Laura verificata, ritorno Da fare, ricerca tramite ID TAL conservata, Scadenze.
Reload ripristina la sessione soltanto dopo nuova verifica; seconda scheda dual-role richiede la propria scelta; logout svuota entrambe le schede. Indietro non riapre il precedente contesto; routing vincolato al tipo autorizzato.
16/16 risorse locali/font HTTP 200, nessun 404 osservato. Nessun errore console non gestito nella verifica finale. Le prove di credenziali errate sono dinieghi intenzionali gestiti dalla UI.
La suite backend generale tentata ha riportato 572 PASS, 74 FAIL, 260 SKIP (906 test); nei fallimenti compare il blocco Chromium EPERM. Il backend è rimasto pulito e fermo al checkpoint S07; questi test non sono dichiarati superati.
Frontend pubblico precedente, homepage/menu/sitemap e file utente esterni alla preview invariati; impronta del diff utente esterno ancora 82da3d783cfd7580d3e7e7eae6328174b8c4dada. Nessun commit/push/deploy. Supabase Free e Frankfurt ricontrollati nella dashboard; nessun servizio paid.

Istruzioni e risultati S06 riportati sotto sono **storici, antecedenti ad Auth**: in particolare ingresso senza account, Cambio ruolo e CSP connect-src none non descrivono questa versione.

---

# S06 — preview locale del Forfettario SaaS

Prima preview di prodotto, separata dal Forfettario pubblico. HTML, CSS e moduli JavaScript senza build o nuove dipendenze. Nessun login, collegamento a servizi reali o calcolo fiscale operativo.

## Aprire e provare

Dalla radice del repository frontend:

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

Aprire `http://127.0.0.1:4173/tools/forfettario-saas/`. Arrestare il server con Ctrl+C.

- Entrare come forfettario; in Oggi o Attività, rispondere alla richiesta caricando il documento **di esempio**. Riaprirlo dalla stessa attività.
- Da Attività aprire **Archivio documenti**. **Aggiungi un altro documento** aggiunge un allegato generico: non risponde alla richiesta aperta.
- Usare **Cambia ruolo**, entrare come commercialista e scegliere **Verifica documento** da Da fare. Il documento si apre direttamente: verificarlo e usare **Torna a Da fare**. Il cliente risolto esce dalla coda.
- In Entrate, provare incasso parziale/saldo, aggiunta manuale e importazione d’esempio. Un secondo import non duplica la fattura.
- In Clienti, cercare per nome o ID TAL; aprire e tornare all’elenco: ricerca e posizione si conservano. Da Scadenze, **Dettaglio pagamento** porta al pagamento pertinente.
- Aprire un pannello: il primo Indietro del browser lo chiude senza cambiare pagina. Provare anche Escape, Tab e Shift+Tab.
- Ricaricare la pagina per ripartire: lo stato vive soltanto in memoria nella scheda, senza localStorage/cookie/database. Il cambio ruolo è soltanto una funzione della demo, non autorizzazione.

## Struttura e scelte

| Percorso | Navigazione |
|---|---|
| Ingresso | Forfettario / Commercialista |
| Contribuente | Oggi, Entrate, Tasse, Attività |
| Studio | Da fare, Clienti, Scadenze |
| Cliente aperto dallo Studio | Riepilogo, Entrate, Tasse, Attività; ritorno alla provenienza: Da fare, Clienti o Scadenze |
| Archivio documenti | Destinazione secondaria da Attività e dal documento contestuale |

Oggi mostra incassi, riserva fiscale stimata, prossimo pagamento previsto e l’azione da svolgere. Dopo l’invio resta una conferma compatta: ora tocca allo Studio. Da fare mette prima documenti verificabili e differenze da controllare; le attese hanno peso minore e le eccezioni risolte scompaiono. Attività unisce richieste, risposte e documenti con al massimo una CTA primaria per attività. Eliminati slogan operativi, presentazioni ripetute dello Studio e card celebrative. Stile, fatture, incassi parziali e distinzione attuale/previsione sono preservati.

Skill utilizzata: `ui-ux-pro-max`. Direzione minimalista, palette chiara verde/bianchi caldi, caratteri Inter e Newsreader **già locali**, SVG coerenti. Scartate le proposte automatiche da fintech scuro e font informali perché inadatte al brief. Nessuna risorsa da CDN.

Su mobile la barra principale contiene quattro voci per la posizione personale/cliente e tre per lo Studio. Nel cliente, il ritorno contestuale è sopra la barra inferiore. La richiesta della home arriva prima del pagamento; a 390×844 e 375×812 il pulsante di upload è visibile senza scroll. Metadata documentali verticali, attività senza scroll interno, dialog nel viewport, chiusura di almeno 44×44 px anche con titoli lunghi, focus delimitato/restituito, Escape e Back. Ricerca e scroll dell’elenco sono conservati in memoria; nessuna persistenza reale.

La previsione personale rimane nel percorso contribuente; lo Studio vede i dati condivisi. Questa è una scelta di presentazione coerente con PrivateYearPlan, **non** una dimostrazione di sicurezza/RLS nella demo.

## Confine dei mock

- `demo-service.js`: quattro persone e controparti inventate, ID TAL sintetici stabili, snapshot in centesimi, comandi e selettori di view model. Non importa codice backend.
- `app.js`: viste comuni ai due percorsi, routing hash, interazioni e feedback. Il codice delle viste non contiene endpoint o credenziali. La sostituzione dei mock passerà dal modulo dati e dall’orchestrazione asincrona delle azioni; Auth, autorizzazioni e caricamento reale saranno lavoro separato.
- `app.css`, `mark.svg`: grafica isolata. Solo i font esistenti sono riutilizzati, senza modificarli.
- `index.html`: noindex/nofollow e CSP con `connect-src 'none'`, `form-action 'none'`, soli script/font/stili locali.
- `preview.test.mjs`: nove controlli ripetibili, senza browser o rete, inclusa la distinzione fra allegato generico ed evidenza della richiesta.

Il caricamento aggiunge solo una voce in memoria: non legge, genera, carica o scarica un PDF. L’importazione usa una riga prestabilita, non un parser. Le schermate secondarie degli altri clienti hanno dati ridotti; Mario copre l’intero percorso. Non esistono dossier Redditi PF, F24, AI, invii, login o persistenza.

## Esempio fiscale

Snapshot didattici, non risultati di una chiamata al motore. Mario è un consulente sintetico con coefficiente 78%, imposta 15%, Gestione Separata 26,07%, nessun’altra copertura. Nell’esempio sono già stati versati 4.500 € di acconti previdenziali dell’anno, dedotti dal reddito imponibile e dall’accantonamento residuo. Totali e arrotondamenti in centesimi sono verificati dal test.

Incassi iniziali: 31.240 €; imposta stimata: 2.980,08 €; contributi: 6.352,53 €; **riserva fiscale stimata: 4.832,61 €**. Previsione separata su 42.000 € di incassi: riserva 8.279,53 €. La riserva non rappresenta denaro già accantonato, saldo bancario o un pagamento dovuto a una data. Il **prossimo pagamento previsto** (30 novembre, 2.140 €, imposte e contributi) è un esempio distinto. Le fixture non definiscono una riconciliazione fra questi importi: non si affermano somma, compensazione o inclusione. La stessa spiegazione espandibile è usata in Oggi e Tasse. **Dettaglio riserva** apre sempre la situazione attuale, anche dopo aver consultato la previsione; **Dettaglio pagamento** porta alla scadenza.

Le modifiche agli incassi **non ricalcolano** gli snapshot fiscali: in Oggi compare “Stima iniziale della demo” e il dettaglio Tasse esplicita questo limite. Il futuro motore rimane quello TAL già approvato. Non sostituire gli output autorevoli con questi esempi.

Riscontri utilizzati per la plausibilità degli esempi: [INPS, aliquote Gestione Separata 2026](https://www.inps.it/it/it/inps-comunica/notizie/dettaglio-news-page.news.2026.02.gestione-separata-le-aliquote-contributive-per-il-2026.html), [Agenzia delle Entrate, calendario della precompilata](https://infoprecompilata.agenziaentrate.gov.it/portale/scadenze). Nessuna CU usata come richiesta ordinaria: l’esempio centrale è una ricevuta di versamento contributivo.

## Verifica Step 3 — 27 settembre 2026

```powershell
node --test tools/forfettario-saas/preview.test.mjs
```

| Verifica | Esito |
|---|---|
| Test S06: isolamento, centesimi, stato condiviso, incassi invalidi/parziali, import, messaggi, eccezioni, evidenza esatta e contesto pagamento | 9/9 PASS |
| Ispezione visuale e geometria | Schermate principali a 1440×900, 1024×768, 390×844 e 375×812; nessun overflow osservato; target verificati ≥44×44 px dopo la correzione del pulsante Chiudi |
| Journey contribuente | Fattura da 900 € → incasso → richiesta → upload simulato → documento contestuale → previsione → Oggi; PASS |
| Archivio | Upload generico lascia richiesta aperta; verifica della richiesta riguarda soltanto il documento associato; PASS |
| Journey Studio | Documento aperto da Da fare → verifica → ritorno diretto → cliente cercato → ricerca conservata → pagamento pertinente; PASS |
| Ritorno e accessibilità | Primo Back chiude il pannello; Escape e Tab/Shift+Tab delimitano il focus; ritorno contestuale e ricerca ID TAL; scroll elenco conservato anche con Back (103 px prima/dopo a 375×640); PASS |
| Console e risorse osservate | 0 errori/warning e nessun 404 segnalato nel browser; 7 risorse osservate tutte localhost; CSP e codice escludono chiamate a servizi/API |
| Suite statica frontend | 310/310 PASS |
| Suite generale backend, senza modifiche | Non verde in questo ambiente: 573 PASS, 260 SKIP, 73 FAIL; riscontrato blocco `browserType.launch: spawn EPERM` nelle prove con Chromium esterno |

La verifica S06 è stata svolta nel browser disponibile con click, scroll, digitazione, modali e navigazione. La suite browser/E2E generale preesistente non è certificata nuovamente da questo step. I risultati del precedente Step 1 non sono presentati come nuove esecuzioni. La sonda HTTP indipendente dalla shell ha restituito ECONNREFUSED; la preview e le sue risorse sono state verificate dal browser, dove il caricamento funziona. Nessuna installazione o modifica globale per aggirare questi limiti.

Restano da valutare con utenti reali la comprensione degli importi e il lavoro su portafogli numerosi. Le prove mobile usano viewport desktop: non verificano hardware iOS/Android, tastiera virtuale o selettore file nativo. L’upload resta deliberatamente simulato. Nessun collegamento a servizi reali in questo step.

Nessun commit, push o deployment. Nessuna modifica alle cartelle del Forfettario pubblico, al backend, al Worker, alla homepage, al catalogo o alla sitemap. I cambiamenti utente preesistenti sono preservati.

## Verifica checkpoint S06 — 27 settembre 2026

Rieseguiti: suite S06 **9/9 PASS**, controlli statici frontend **310/310 PASS**, journey contribuente e Studio nel browser. Le 38 rilevazioni alle larghezze 1440, 1024, 390 e 375 px non mostrano overflow orizzontale o bersagli visibili inferiori a 44 px. Console senza errori/warning, nessun 404 osservato e sole sette risorse locali; nessun servizio reale collegato. Le fixture della demo sono state ripristinate dopo le simulazioni.

La suite backend non è stata rieseguita in questo checkpoint, come richiesto: l'ultima esecuzione riportata sopra aveva failure di avvio Chromium `EPERM`, non attribuite alle modifiche S06. Hash e diff confermano che il Forfettario pubblico e le superfici pubbliche preesistenti sono invariati.

Checkpoint autorizzato sul branch separato `checkpoint/s06-ux-preview`. GitHub Pages pubblica da `main`: questo checkpoint lascia `main` e le impostazioni Pages invariati e non prevede deployment. Il commit comprende esclusivamente questa cartella; le modifiche preesistenti dell'utente restano escluse.

## S06.1 — Rilevazione brand prima delle modifiche

Fonti lette: `assets/site-shell.css`, `assets/tal-app.css`, `assets/tal-design.css`, font locali e header della homepage. Confronto renderizzato: homepage, Forfettario pubblico, F24 e Analisi di bilancio, senza operare sui loro dati.

| Token TAL rilevato | Valore esistente | Uso nella preview |
|---|---|---|
| `--tal-accent / -2 / -deep / -soft` | `#145368 / #1D6A7F / #0C3341 / #EAF2F5` | CTA e hover, link, navigazione attiva, accenti e superfici discrete |
| `--tal-session-1 / --tal-save-1` | `#5B3A8C / #6D3C99` | Viola già presente nelle barre/azioni TAL: focus e selezioni secondarie, senza gradienti |
| `--tal-violet` editoriale | `#A867D8` | Riferimento della famiglia viola; per i controlli su carta si usa la variante scura già esistente |
| `--tal-paper / -card / -sunken` | `#F6F5F1 / #FFFFFF / #F0EFEB` | Canvas, superfici di lavoro e dettagli neutri |
| `--tal-fg / -ink / -ink-2 / -ink-3` | `#0B0B0B / #1D1B16 / #47443F / #6E6B65` | Testo, importi operativi, secondari e bordi dei campi |
| `--tal-line / -line-2` | `#E7E4DC / #DCDAD4` | Separatori e bordi |
| `--tal-warn / --tal-gold` | `#A53D28 / #8B6A16` | Messaggi espliciti già presenti; nessuna nuova semantica fiscale |

Nel CSS condiviso, le variabili storiche `--tal-purple` sono alias petrolio: il viola effettivo dei tool viene dai token session/save definiti più avanti. Il focus attuale dei tool è petrolio; S06.1 usa il viola scuro TAL per il focus, come richiesto. Il sito editoriale usa testi chiari su fondo scuro: questi valori non vengono trasferiti sui fondi chiari dell'app.

Identità: riutilizzare il monogramma RZ effettivamente incorporato nell'header TAL, mantenendone pixel e proporzioni, al posto della T inventata in S06. Tipografia: Inter per lavoro quotidiano, numeri e pannelli; Newsreader solo nel titolo d'ingresso, in continuità con la homepage. Nessuna modifica a IA, dati, copy operativo o journey.

### Esito S06.1

Allineati soltanto `app.css`, `mark.svg`, il theme-color di `index.html` e questo README. CTA/link/navigazione usano petrolio; nome TAL, focus e selezioni secondarie usano viola scuro. Le due opzioni attuale/previsione hanno lo stesso trattamento quando selezionate: viola indica selezione, non previsione o un significato fiscale. Importi dovuti e stati documentali restano leggibili attraverso testo, icone e gerarchia. Nessun gradiente aggiunto, nessun aumento di padding o altezza delle superfici.

Il PNG del monogramma è copiato byte per byte dall'header homepage e incorporato in `mark.svg` su una piccola base petrolio, senza ridisegnarlo o alterarne le proporzioni. SHA-256 del PNG originale/riusato: `63d8ff503e0ee79daf8c0134b02572fcece4f386e7b9a9623f4b17050c1e0413`. Nessuna nuova risorsa esterna.

Verifica nel browser: confronto TAL/F24 e SaaS alla stessa larghezza, entrambe le aree a 1440×900, 1024×768, 390×844 e 375×812; nessun overflow o target visibile inferiore a 44 px nelle 44 rilevazioni. Journey contribuente (fattura, incasso, richiesta, documento, previsione, Oggi) e Studio (verifica, ritorno alla coda, ricerca ID conservata e scadenza pertinente): PASS. Verificati focus viola, Tab, delimitazione del focus nella modale e Back; i mock sono stati ripristinati.

Test S06 **9/9 PASS**, statici frontend **310/310 PASS**. Nessun errore/warning console o 404 osservato; sette risorse locali e CSP `connect-src 'none'`. Contrasto minimo dei testi visibili campionati nelle schermate mobili: **4,68:1**, senza failure; non costituisce certificazione completa di accessibilità. Il confronto visivo conferma la stessa identità TAL con layout S06 autonomo.

`app.js`, `demo-service.js` e i test funzionali sono invariati; nessuna modifica fuori dalla preview rispetto allo snapshot iniziale. Lavoro locale su `checkpoint/s06-ux-preview`, senza commit, push, deployment o collegamenti a servizi reali.
