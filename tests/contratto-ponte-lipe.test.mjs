/* Il contratto fra la pagina di LIPE e il ponte verso il servizio di calcolo.
 *
 * PERCHÉ ESISTE QUESTO FILE
 *
 * Il motore fiscale di LIPE non è più nel browser: la pagina costruisce il
 * payload, il servizio calcola, il ponte rimette i numeri dove la pagina se li
 * aspetta. Il collegamento fra le due parti non passa da un'interfaccia
 * dichiarata: passa da **nomi**. Un `id` di pulsante, un attributo su una
 * casella, una funzione globale, una chiave di periodo.
 *
 * Sono legami che si rompono in silenzio. Rinominare `export-xml` non produce
 * nessun errore: produce un pulsante che chiede numeri che il servizio non ha
 * ancora dato, e un messaggio di guasto davanti a un utente. Togliere
 * `data-manual-field` da una casella non rompe niente al caricamento: fa
 * sparire VP7–VP13 dal payload, e i conti tornano lo stesso — sbagliati.
 *
 * Questo file trasforma quei legami in test che falliscono forte. È la Fase 0
 * del rifacimento dell'interfaccia: serve a poter spostare le schermate senza
 * chiedersi ogni volta se si è appena scollegato il calcolo.
 *
 * COME È FATTO
 *
 * Quasi tutto il contratto viene **dedotto dal ponte stesso**, che è pubblicato
 * dentro la pagina. Se domani il ponte comincia a dipendere da un nuovo `id`,
 * questo file lo pretende dalla pagina senza che nessuno debba ricordarsene.
 * Le poche cose che non si possono dedurre sono dichiarate qui sotto, ognuna
 * con il motivo per cui c'è.
 *
 * NON copre la logica fiscale: quella sta nel repository privato, insieme ai
 * 257 casi congelati. Qui si controllano solo i punti di contatto.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGINA = path.join(root, 'tools', 'lipe', 'index.html');
const html = fs.readFileSync(PAGINA, 'utf8');

const APRE = '/* >>> PONTE LIPE';
const CHIUDE = '/* >>> fine PONTE LIPE <<< */';

const ponte = (() => {
  const i = html.indexOf(APRE);
  const j = html.indexOf(CHIUDE);
  return i === -1 || j === -1 ? null : html.slice(i, j + CHIUDE.length);
})();
/* La pagina senza il ponte: è lì che devono trovarsi le cose di cui il ponte
   ha bisogno. Cercarle anche dentro il ponte le troverebbe sempre. */
const pagina = ponte ? html.replace(ponte, '') : html;

const chiamate = (testo, nome) =>
  (testo.match(new RegExp('(?<![A-Za-z0-9_$.])' + nome + '\\s*\\(', 'g')) || []).length;

const dichiaratoNellaPagina = (nome) => new RegExp(
  '(?:^|\\n)\\s*(?:async\\s+)?(?:' +
  'function\\s+' + nome + '\\b' +
  '|(?:const|let|var)\\s+' + nome + '\\b' +
  '|' + nome + '\\s*=\\s*(?:async\\s+)?function' +
  '|window\\.' + nome + '\\s*=' +
  ')', 'm').test(pagina);

/* ─────────────────────────────────────────────────── il ponte c'è ancora */

test('contratto · il ponte è nella pagina, fra i suoi marcatori', () => {
  assert.ok(ponte,
    'non trovo il blocco del ponte. Senza, la pagina non sa più chiedere i numeri ' +
    'al servizio e non sa più calcolarli da sé: il tool è muto.');
  assert.ok(ponte.includes('genera-ponte-lipe.mjs'),
    'il blocco del ponte non dichiara più di essere generato. Va prodotto dal ' +
    'repository privato, non scritto a mano: due copie della stessa logica ' +
    'prima o poi smettono di essere d’accordo.');
});

test('contratto · il ponte sta dentro la closure che gli serve', () => {
  /* `sameContext`, `contextNow`, `stableHash` e `carryIntegrityIssue` sono
     dichiarate dentro la IIFE di `lipe-v340-audit-remediation` e non sono
     raggiungibili da nessun altro blocco <script>. Fuori di lì il ponte
     fallirebbe al primo calcolo. */
  const apre = html.indexOf('<script id="lipe-v340-audit-remediation">');
  const chiude = html.indexOf('</script><script id="tal-publication-i18n">');
  const dove = html.indexOf(APRE);
  assert.ok(apre !== -1 && chiude !== -1, 'la closure attesa non c’è più');
  assert.ok(dove > apre && dove < chiude,
    'il ponte è finito fuori dalla closure: sameContext, contextNow, stableHash e ' +
    'carryIntegrityIssue non sarebbero raggiungibili.');
});

/* ─────────────────────────────── gli id del DOM che il ponte pretende */

/* Dedotti dal ponte: ogni `getElementById('x')` e ogni id che compare negli
   elenchi che il ponte percorre. Se il ponte ne aggiunge uno, questo test lo
   pretende dalla pagina automaticamente. */
const idRichiesti = (() => {
  const s = new Set();
  for (const m of ponte.matchAll(/getElementById\('([^']+)'\)/g)) s.add(m[1]);
  for (const m of ponte.matchAll(/'((?:export|results|period|checks|detail|save)-[a-z]+)'/g)) s.add(m[1]);
  return [...s].sort();
})();

/* Questi il ponte se li crea da solo quando serve mostrare un guasto: non
   devono stare nel markup, e cercarli lì sarebbe un falso allarme. */
const CREATI_DAL_PONTE = ['lipeApiStato', 'lipeApiRiprova'];

test('contratto · ogni id che il ponte cerca esiste nella pagina', () => {
  const mancanti = idRichiesti
    .filter((id) => !CREATI_DAL_PONTE.includes(id))
    .filter((id) => !new RegExp('id="' + id + '"').test(pagina));
  assert.deepStrictEqual(mancanti, [],
    'il ponte cerca questi id e nella pagina non ci sono più: ' + mancanti.join(', ') +
    '\n  Rinominare un id non produce un errore: produce una funzione che smette ' +
    'di essere collegata, in silenzio.');
});

test('contratto · i quattro pulsanti di export tengono il loro id, e sono pulsanti', () => {
  /* Il ponte li riaggancia PER ID dopo il caricamento, perché `initEvents()`
     ha già dato ai pulsanti una copia della funzione originale. Se l’id cambia,
     o se l’elemento non è più un <button> con quell’id, il riaggancio salta e
     l’export chiede numeri che il servizio non ha ancora dato. */
  ['export-pdf', 'export-excel', 'export-xml', 'save-history'].forEach((id) => {
    const re = new RegExp('<button[^>]*id="' + id + '"|id="' + id + '"[^>]*>', 'i');
    assert.ok(re.test(pagina), 'manca il pulsante con id="' + id + '"');
  });
  assert.match(ponte, /\['exportPdf', 'export-pdf'\]/,
    'il ponte non riaggancia più gli export per id: verifica collegaGliExport()');
  assert.match(ponte, /if \(b\) b\.onclick = avvolto;/,
    'il ponte non riattacca più il pulsante: riassegnare la variabile non basta, ' +
    'il pulsante tiene già la sua copia');
  assert.match(ponte, /setTimeout\(collegaGliExport, 0\)/,
    'il riaggancio deve avvenire dopo DOMContentLoaded: prima, exportXml verrebbe ' +
    'riscritta da un blocco più avanti nel file');
});

/* ──────────────────────── le funzioni della pagina che il ponte consuma */

/* Dedotte da `apiDellaPagina` — l’oggetto con cui il ponte passa al
   costruttore del payload le funzioni vere della pagina — più le due strade
   che disegnano e i quattro export. */
const funzioniDellaPagina = (() => {
  const blocco = (ponte.match(/const apiDellaPagina = \{([\s\S]*?)\};/) || [])[1] || '';
  const nomi = new Set();
  blocco.split(/[,\n]/).forEach((riga) => {
    const r = riga.trim();
    if (!r) return;
    /* `nome: altroNome` → vale l'altro nome, che è quello vero della pagina. */
    const alias = r.match(/^[A-Za-z_$][\w$]*\s*:\s*([A-Za-z_$][\w$]*)\s*$/);
    if (alias) { nomi.add(alias[1]); return; }
    /* `nome: () => qualcosa` → la chiave è un nome del ponte, non della pagina:
       si salta. Quello che serve davvero — `carryIntegrityIssue` — è aggiunto
       esplicitamente qui sotto. */
    if (/:\s*\(/.test(r)) return;
    const solo = r.match(/^([A-Za-z_$][\w$]*)\s*$/);
    if (solo) nomi.add(solo[1]);
  });
  ['renderResults', 'renderExportState',
    'exportPdf', 'exportWorkingPaper', 'exportXml', 'saveHistory',
    'esc', 'MONTHS', 'quarterMonths', 'carryIntegrityIssue', 'state'].forEach((n) => nomi.add(n));
  return [...nomi].sort();
})();

test('contratto · la pagina dichiara ancora tutto ciò che il ponte le chiede', () => {
  const mancanti = funzioniDellaPagina.filter((n) => !dichiaratoNellaPagina(n));
  assert.deepStrictEqual(mancanti, [],
    'il ponte usa questi nomi della pagina e non li trova più: ' + mancanti.join(', ') +
    '\n  Sono le funzioni con cui il browser legge il foglio, applica il codiciario ' +
    'del cliente e conta le anomalie: senza, il payload non si costruisce.');
  assert.ok(funzioniDellaPagina.length >= 15,
    'l’elenco dedotto è sospettosamente corto (' + funzioniDellaPagina.length + '): ' +
    'probabilmente apiDellaPagina non si chiama più così, e questo test ha smesso ' +
    'di controllare qualcosa');
});

/* ──────────────────────── le funzioni che il ponte fornisce alla pagina */

/* Erano nel motore, adesso le fornisce il ponte leggendo la risposta del
   servizio. La pagina le chiama come prima. Elenco congelato: il motore è
   stato tolto il 27 agosto 2026 e questi nomi non torneranno. */
const FUNZIONI_MIGRATE = [
  'computePeriod', 'checks', 'periodDescriptors', 'quarterCode', 'groupParticipant',
  'vp7Limit', 'hasBlocking', 'officialOutputProblems', 'lipeOfficialProblems',
  'lipeQuarterCode', 'lipeGroupParticipant', 'lipeVp7Limit'
];

const fornitiDalPonte = [...new Set(
  [...ponte.matchAll(/window\.([A-Za-z_$][\w$]*)\s*=/g)].map((m) => m[1]))];

test('contratto · quello che la pagina chiama e non dichiara, il ponte lo fornisce', () => {
  const rotti = FUNZIONI_MIGRATE
    .filter((n) => chiamate(pagina, n) > 0)
    .filter((n) => !fornitiDalPonte.includes(n) && !dichiaratoNellaPagina(n));
  assert.deepStrictEqual(rotti, [],
    'la pagina chiama questi nomi, il ponte non li fornisce più e la pagina non li ' +
    'dichiara: ' + rotti.join(', ') +
    '\n  Sono le funzioni del motore, che ora vivono nel servizio. Al primo uso ' +
    'la pagina troverebbe undefined.');
});

test('contratto · nessuna funzione del motore è tornata nella pagina', () => {
  /* Il contrario del test sopra: se qualcuno le rimettesse in pagina «per
     comodità», il calcolo tornerebbe nel browser e la migrazione varrebbe zero. */
  const tornate = [
    'function computePeriod(', 'function checks(){', 'function automaticCarry(',
    'function periodDescriptors(', 'function vp7Limit(', 'function groupParticipant(',
    'function isLastAnnualPeriod(', 'function rowInPeriod(', 'const oldChecks=checks;'
  ].filter((p) => pagina.includes(p));
  assert.deepStrictEqual(tornate, [],
    'logica fiscale rientrata nel sorgente pubblico: ' + tornate.join(', '));
});

/* ─────────────────────────────────── i valori scritti a mano: VP7–VP13 */

test('contratto · le caselle manuali dichiarano periodo e campo', () => {
  /* `state.manual` è indicizzato per chiave di periodo, e ogni casella dice a
     quale periodo e a quale rigo appartiene con questi due attributi. Il
     gestore che salva il valore li legge da lì; il payload li spedisce con
     quelle chiavi. Toglierli non rompe il caricamento della pagina: fa sparire
     VP7–VP13 dal calcolo, e i conti tornano lo stesso, sbagliati. */
  assert.ok(/data-manual-key="\$\{[^"]*\}"/.test(pagina),
    'le caselle manuali non dichiarano più il periodo (data-manual-key)');
  assert.ok(/data-manual-field="\$\{?[^"]*\}?"/.test(pagina),
    'le caselle manuali non dichiarano più il rigo (data-manual-field)');
  assert.match(pagina, /\[data-manual-field\]/,
    'nessuno legge più le caselle manuali: il gestore che salva il valore è sparito');
  assert.match(pagina, /inp\.dataset\.manualKey/,
    'il gestore non usa più la chiave di periodo per salvare il valore');
  assert.match(pagina, /inp\.dataset\.manualField/,
    'il gestore non usa più il nome del rigo per salvare il valore');
});

test('contratto · esistono le caselle per tutti i righi che il payload spedisce', () => {
  /* VP7–VP12 nascono da `edit('VP7', …, 'vp7')`, VP13 è scritto a mano nel
     markup della griglia: si accettano entrambe le grafie. */
  ['vp7', 'vp8', 'vp9', 'vp10', 'vp11', 'vp12', 'vp13'].forEach((rigo) => {
    const c = new RegExp("'" + rigo + "'|data-manual-field=\"" + rigo + "\"");
    assert.ok(c.test(pagina),
      'nella pagina non c’è più la casella per ' + rigo.toUpperCase());
  });
  ['subforn', 'eventi'].forEach((flag) => {
    assert.ok(new RegExp("data-manual-field=\"" + flag + "\"").test(pagina),
      'manca la casella «' + flag + '», che il payload spedisce come sì/no');
  });
});

test('contratto · le chiavi di periodo restano quelle che il ponte filtra', () => {
  /* Il ponte lascia passare solo M1…M12 e Q1…Q4. Le chiavi ora le costruisce
     il servizio e arrivano nella risposta: la pagina deve continuare a usare
     `descriptor.key` così com’è, senza rifabbricarla. */
  assert.match(ponte, /const CHIAVE_PERIODO = \/\^\(\?:M\(\?:\[1-9\]\|1\[0-2\]\)\|Q\[1-4\]\)\$\//,
    'il filtro delle chiavi di periodo è cambiato: verifica che combaci con quelle ' +
    'che il servizio restituisce');
  assert.match(pagina, /data-manual-key="\$\{d\.key\}"/,
    'la casella non usa più la chiave del periodo così come arriva dal servizio');
});

/* ───────────────────────── le due strade che passano dal servizio */

test('contratto · disegnare passa sempre dal risultato del servizio', () => {
  /* `renderResults` e `renderExportState` sono i due punti in cui il ponte si
     assicura di avere il risultato prima di disegnare. Un nuovo punto di
     disegno che non passi di lì troverebbe il risultato mancante. */
  assert.match(ponte, /renderResults = conIlServizio\(renderResults\);/,
    'renderResults non passa più dal servizio');
  assert.match(ponte, /renderExportState = conIlServizio\(renderExportState\);/,
    'renderExportState non passa più dal servizio');
  assert.match(ponte, /function assicura\(poi\)/,
    'manca la funzione che garantisce il risultato prima di disegnare');
});

test('contratto · senza risultato la pagina si rifiuta, non calcola', () => {
  assert.match(ponte, /throw rifiuta\(\);/,
    'il rifiuto non c’è più: senza motore in pagina, l’alternativa al rifiuto è ' +
    'disegnare numeri che nessuno ha calcolato');
  assert.match(ponte, /RIFIUTI \+= 1;/,
    'i rifiuti non vengono più contati: è la spia che dice se una strada ha smesso ' +
    'di passare dal servizio');
  ['computePeriodInPagina', 'checksInPagina'].forEach((n) => {
    assert.equal(ponte.includes(n), false,
      'nel ponte è tornato un ripiego sul motore in pagina (' + n + '), che non esiste più');
  });
});

test('contratto · senza cliente non si chiama il servizio', () => {
  assert.match(ponte, /if \(nienteDaCalcolare\(\)\) \{\s*\n\s*return controlliSenzaCliente\(/,
    'la schermata di partenza deve restare locale: è interfaccia, non calcolo');
  assert.match(ponte, /if \(!state\.activeRecord\) return originale\.apply\(this, arguments\);/,
    'senza cliente attivo né i disegni né gli export devono chiedere niente al servizio');
});

/* ───────────────────────────── il guasto: riquadro, Riprova, svuotamento */

test('contratto · il riquadro di guasto e il pulsante Riprova', () => {
  assert.match(ponte, /el\.id = 'lipeApiStato';/,
    'il riquadro di stato non ha più il suo id');
  assert.match(ponte, /id="lipeApiRiprova"/,
    'il pulsante Riprova non c’è più');
  assert.match(ponte, /mostraGuastoLipe\(g, riprovaTutto\)/,
    'Riprova non rifà più tutti i disegni rimasti a metà: con due in attesa ne ' +
    'rifarebbe uno solo, e la schermata resterebbe vuota mentre l’errore sparisce');
  assert.match(ponte, /svuotaRisultatoLipe\(\);\s*\n\s*mostraGuastoLipe/,
    'prima si svuota, poi si dice che è andata male: numeri vecchi accanto a un ' +
    'errore si leggono come numeri nuovi');
  /* Il riquadro si aggancia a results-section, prima di results-empty. */
  assert.match(ponte, /getElementById\('results-section'\)/);
  assert.match(ponte, /getElementById\('results-empty'\)/);
});

test('contratto · si bussa prima di parlare', () => {
  assert.match(ponte, /if \(!\(await ilServizioLipeCe\(\)\)\) throw guastoLipe\('assente'\);/,
    'manca la sonda che precede ogni invio: senza, un POST con dentro gli importi ' +
    'finirebbe a GitHub Pages');
  const i = ponte.indexOf('async function chiamaLipe(');
  const j = ponte.indexOf('ilServizioLipeCe()', i);
  const k = ponte.indexOf('body: JSON.stringify(corpo)', i);
  assert.ok(i !== -1 && j !== -1 && k !== -1 && j < k,
    'la sonda deve stare prima del corpo della richiesta, non dopo');
});

/* ──────────────────────────────────── quello che il payload legge */

test('contratto · lo stato da cui nasce il payload', () => {
  /* Il costruttore del payload legge questi campi. Riorganizzare lo stato senza
     aggiornare il costruttore — che vive nel repository privato — produce un
     payload incompleto e un calcolo sbagliato che nessuno segnala. */
  ['state.rows', 'state.manual', 'state.activeRecord', 'state.activeClientKey',
    'state.year', 'state.quarter', 'state.importContext'
  ].forEach((campo) => {
    assert.ok(ponte.includes(campo) || ponte.includes(campo.replace('state.', 'stato.')),
      'il ponte non legge più ' + campo + ': verifica costruisciPayload nel repository privato');
  });
  /* E i campi del cliente e del codiciario da cui dipendono gli aggregati. */
  ['periodType', 'quarterRegime', 'groupVat', 'groupLiquidation', 'lastMonth']
    .forEach((c) => assert.ok(ponte.includes(c), 'il payload non legge più cliente.' + c));
  ['baseRow', 'dueRow', 'dedRow', 'basePct', 'duePct', 'dedPct']
    .forEach((c) => assert.ok(ponte.includes(c), 'l’aggregazione non legge più codiciario.' + c));
});

test('contratto · la risposta del servizio viene letta con i nomi giusti', () => {
  ['vp2', 'vp6', 'vp14deb', 'vp14cre', 'saldo', 'codiceTrimestre',
    'partecipanteAlGruppo', 'tettoVp7', 'bloccanti', 'blocca', 'controlli'
  ].forEach((campo) => {
    assert.ok(ponte.includes(campo),
      'il ponte non legge più «' + campo + '» dalla risposta: se il servizio lo manda ' +
      'ancora e la pagina non lo usa, qualcosa sullo schermo è vuoto');
  });
});

/* ──────────────────────────────────────────── privacy: la riga rossa */

test('contratto · dal browser non esce niente di identificativo', () => {
  const costruttore = (ponte.match(/function costruisciPayload\(stato, api\) \{([\s\S]*?)\n\}/) || [])[1];
  assert.ok(costruttore, 'non trovo il costruttore del payload');
  ['denom', 'piva', 'cf', 'repCf', 'interCf', 'notes', 'sourceFile', 'code', 'description', 'note']
    .forEach((campo) => {
      assert.equal(new RegExp('\\b' + campo + ':').test(costruttore), false,
        campo + ' non deve comparire fra i campi che partono');
    });
  assert.match(ponte, /eventi: !!m\.eventi/,
    'il codice degli eventi eccezionali deve partire come sì/no, non come testo');
  assert.match(ponte, /const PERCORSO_LIPE = '\/api\/lipe\/calcola';/,
    'il servizio si raggiunge sulla stessa origine del sito');
  assert.equal(/https:\/\/[a-z0-9-]+\.workers\.dev/.test(ponte), false,
    'un indirizzo scritto nella pagina finirebbe pubblicato');
});

/* ───────────────────────────────────────────────── il ritmo delle richieste */

test('contratto · una richiesta per stato, e non più di una ogni 600 ms', () => {
  assert.match(ponte, /if \(chiave === impronta && inMemoria\) return Promise\.resolve\(inMemoria\);/,
    'è sparita la memoria sul payload: si tornerebbe a una richiesta per ricalcolo, ' +
    'e la pagina ne fa 54 per ogni modifica');
  assert.match(ponte, /if \(inVolo && inVolo\.impronta === chiave\) return inVolo\.promessa;/,
    'è sparita la condivisione della richiesta in volo');
  assert.match(ponte, /minimoFraRichieste: 600/,
    'è sparita la distanza minima fra due partenze: con la rete veloce una raffica ' +
    'di modifiche supererebbe il limite di venti richieste ogni dieci secondi');
});
