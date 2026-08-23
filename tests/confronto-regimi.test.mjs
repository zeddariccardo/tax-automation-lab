/* Tax Automation Lab — Confronto regimi: i casi limite del motore
   Copyright (c) 2026 Riccardo Zedda — MIT

   Perché esiste. Il brief del tool chiede espressamente di provare i casi
   limite «almeno a 85.000, 85.001, 100.000 e 100.001», entrambe le aliquote
   del forfettario, le due professioni, costi nulli ed elevati, e il compenso
   amministratore sotto e sopra il massimale contributivo. Quei casi erano
   stati eseguiti a mano il 21 agosto 2026 prima di portare il motore: qui
   diventano automatici, perché un controllo eseguito una volta non protegge
   dalla regressione successiva.

   Come funziona. Il motore vive dentro `<script id="cf-engine">` nella pagina
   del tool: il test lo estrae e lo esegue in una sandbox, senza DOM. Non è una
   copia — se il tool cambia, cambia anche quello che il test misura. Copiare il
   motore in un file di test avrebbe creato due sorgenti di verità, che è
   esattamente il difetto che gli altri test di questo repository esistono per
   impedire.

   Uso:  node --test "tests/*.test.mjs"
*/
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const html = fs.readFileSync(path.join(root, 'tools', 'confronto-regimi', 'index.html'), 'utf8');

/* ---- estrazione del motore ---------------------------------------------- */

const blocco = html.match(/<script id="cf-engine">([\s\S]*?)<\/script>/);
assert.ok(blocco, 'nella pagina non trovo <script id="cf-engine">');

const sandbox = {};
vm.createContext(sandbox);
new vm.Script(blocco[1] + '\n;({cfEngine, CF_PARAMS, CF_COSTI_DEFAULT, CF_FONTI, CF_RULESET, cfAssunzioni});')
  .runInContext(sandbox);
const {cfEngine, CF_PARAMS, CF_COSTI_DEFAULT, CF_FONTI, CF_RULESET, cfAssunzioni} =
  new vm.Script('({cfEngine, CF_PARAMS, CF_COSTI_DEFAULT, CF_FONTI, CF_RULESET, cfAssunzioni})')
    .runInContext(sandbox);

/* ---- un input di partenza ricco di default espliciti -------------------- */

const BASE = {
  profession: 'commercialista', year: 2026, revenue: 85000, previousRevenue: 80000,
  otherIncome: 0, employeeIncomePrev: 0, employeeIncomeCurr: 0,
  ownership: 100, distribution: 100, admin: 0,
  extractionMode: 'dividend', startup: false, incompatible: false, employer: false,
  pensionRate: 12, adminTreatment: 'cassa', inpsRate: 24, regionalRate: 1.23,
  municipalRate: 0.8, maternity: 0, companyOverhead: 0, irapRate: 3.9
};

const costi = (importi = {}) => CF_COSTI_DEFAULT.map(d => ({
  ...d, amount: importi[d.id] || 0, gross: false
}));

const run = (over = {}, importi = {}) =>
  cfEngine({...BASE, ...over, costs: costi(importi)});

const forf = r => r.scenari[0];
const ord = r => r.scenari[1];
const soc = r => r.scenari[2];

/* ---- 1. le soglie del forfettario --------------------------------------- */

test('85.001–100.000: il forfettario resta applicabile nell’anno, oltre 100.000 no', () => {
  assert.equal(forf(run({revenue: 85000})).applicabile, true, 'a 85.000 deve essere applicabile');
  assert.equal(forf(run({revenue: 85001})).applicabile, true,
    'a 85.001 deve restare applicabile nell’anno: l’uscita è dal periodo successivo');
  assert.equal(forf(run({revenue: 100000})).applicabile, true, 'a 100.000 deve essere ancora applicabile');
  assert.equal(forf(run({revenue: 100001})).applicabile, false,
    'oltre 100.000 la cessazione è nello stesso anno');
});

test('fra le due soglie lo stato dichiara l’uscita dal periodo successivo', () => {
  assert.match(forf(run({revenue: 92000})).stato, /periodo successivo/,
    'a 92.000 lo stato deve dire che l’uscita è dal periodo successivo');
  assert.doesNotMatch(forf(run({revenue: 80000})).stato, /periodo successivo/,
    'sotto la soglia non deve annunciare nessuna uscita');
});

test('i compensi dell’anno precedente oltre la soglia escludono il forfettario', () => {
  assert.equal(forf(run({previousRevenue: 85001})).applicabile, false);
});

/* ---- 2. l’aliquota del 5% ---------------------------------------------- */

test('il 5% non si perde perché i compensi stanno fra 85.000 e 100.000', () => {
  for (const revenue of [50000, 85000, 92000, 100000]) {
    const r = run({revenue, previousRevenue: 40000, startup: true});
    const s = forf(r);
    const base = s.dettaglio.base;
    assert.ok(base > 0, `a ${revenue} la base imponibile deve essere positiva`);
    const aliquota = s.imposte / base;
    assert.ok(Math.abs(aliquota - 0.05) < 1e-9,
      `a ${revenue} l’aliquota effettiva è ${(aliquota * 100).toFixed(2)}%, attesa 5%`);
  }
});

test('senza requisiti dichiarati si applica l’aliquota ordinaria', () => {
  const s = forf(run({revenue: 60000, previousRevenue: 40000, startup: false}));
  const aliquota = s.imposte / s.dettaglio.base;
  assert.ok(Math.abs(aliquota - 0.15) < 1e-9, `attesa 15%, trovata ${(aliquota * 100).toFixed(2)}%`);
});

/* ---- 3. le cause ostative ---------------------------------------------- */

test('ogni causa ostativa dichiarata esclude il forfettario', () => {
  assert.equal(forf(run({employeeIncomePrev: 35001})).applicabile, false,
    'lavoro dipendente dell’anno precedente oltre soglia');
  assert.equal(forf(run({incompatible: true})).applicabile, false, 'partecipazioni incompatibili');
  assert.equal(forf(run({employer: true})).applicabile, false, 'attività verso l’ex datore');
  assert.equal(forf(run({}, {personale: 20001})).applicabile, false, 'spese per personale oltre soglia');
  assert.equal(forf(run({}, {personale: 19999})).applicabile, true, 'sotto soglia resta applicabile');
});

test('i redditi da lavoro dipendente dei due anni non si confondono', () => {
  /* CF-003. La causa ostativa guarda l'anno precedente; il reddito corrente
     serve alle detrazioni. Prima era un campo solo, etichettato come quota
     degli altri redditi correnti e usato per la causa ostativa: un dato
     inserito secondo l'etichetta finiva in una regola di un altro periodo. */
  assert.equal(forf(run({employeeIncomePrev: 40000, employeeIncomeCurr: 0})).applicabile, false,
    'il reddito dell’anno precedente sopra soglia esclude il forfettario');
  assert.equal(forf(run({employeeIncomePrev: 0, employeeIncomeCurr: 40000})).applicabile, true,
    'il reddito dell’anno corrente non è una causa ostativa');
});

test('la detrazione segue la natura prevalente degli altri redditi', () => {
  /* CF-004, nella forma dichiarata: con altri redditi in prevalenza da lavoro
     dipendente si applica quella detrazione, altrimenti quella autonoma. */
  const dip = run({otherIncome: 40000, employeeIncomeCurr: 30000});
  const aut = run({otherIncome: 40000, employeeIncomeCurr: 0});
  assert.equal(dip.detrazioneApplicata, 'dipendente');
  assert.equal(aut.detrazioneApplicata, 'autonomo');
  assert.notEqual(Math.round(ord(dip).netto), Math.round(ord(aut).netto),
    'due detrazioni diverse non possono dare lo stesso netto');
});

/* ---- 4. il massimale limita la base, non il compenso -------------------- */

test('il massimale INPS limita la base contributiva, non il compenso amministratore', () => {
  const massimale = CF_PARAMS[2026].inps.massimale;
  /* Meccanica manuale: in automatico il compenso lo scegle l'ottimizzatore, e
     quello che si misura qui e' cosa fa il motore col compenso CHIESTO. */
  const sopra = soc(run({mixMode: 'manual', revenue: 500000, admin: massimale + 60000,
    extractionMode: 'mix', adminTreatment: 'inps', inpsRate: 24}));
  assert.ok(sopra.dettaglio.compenso > massimale,
    `il compenso erogato (${Math.round(sopra.dettaglio.compenso)}) deve poter superare il massimale`);
  const atteso = massimale * 0.24 * (1 / 3);
  assert.ok(Math.abs(sopra.dettaglio.inpsSocio - atteso) < 1,
    `contributo del socio ${sopra.dettaglio.inpsSocio.toFixed(2)}, atteso ${atteso.toFixed(2)}: la base deve fermarsi al massimale`);
});

test('il riparto della Gestione Separata è un terzo al socio e due terzi alla società', () => {
  const s = soc(run({mixMode: 'manual', revenue: 400000, admin: 60000, extractionMode: 'mix',
    adminTreatment: 'inps', inpsRate: 24}));
  const rapporto = s.dettaglio.inpsSocieta / s.dettaglio.inpsSocio;
  assert.ok(Math.abs(rapporto - 2) < 1e-6, `rapporto società/socio ${rapporto}, atteso 2`);
});

test('l’aliquota senza altra copertura è 33,72%, non 35,03%', () => {
  const p = CF_PARAMS[2026].inps;
  assert.equal(p.senzaAltraCopertura, 0.3372,
    'il 35,03% incorpora la DIS-COLL, dalla quale gli amministratori sono esclusi');
});

/* ---- 5. il dividendo non genera contributi ----------------------------- */

test('la contribuzione grava sull’utile attribuibile, non sul dividendo distribuito', () => {
  const contributi = [0, 50, 100].map(distribution =>
    soc(run({revenue: 300000, distribution, extractionMode: 'dividend'})).dettaglio.cassaSocio);
  assert.ok(Math.abs(contributi[0] - contributi[1]) < 0.01 &&
            Math.abs(contributi[1] - contributi[2]) < 0.01,
    `i contributi cambiano con la distribuzione: ${contributi.map(c => c.toFixed(2)).join(' / ')}`);
});

/* Questi quattro test misurano la meccanica del mix impostato a mano —
   distribuzione, ritenuta, quota di partecipazione, riduzione dal massimale — e
   da quando l'ottimizzazione automatica e' il default vanno dichiarati
   `mixMode: 'manual'`: in automatico il compenso e la quota che impongono qui
   non vengono usati, ed e' giusto cosi'. La meccanica che verificano non e'
   cambiata, e' cambiato quale modalita' la esercita. */
test('l’utile trattenuto è mostrato a parte e non entra nel netto personale', () => {
  const s = soc(run({mixMode: 'manual', revenue: 300000, distribution: 0, extractionMode: 'dividend'}));
  assert.ok(s.trattenuto > 0, 'con distribuzione a zero l’utile trattenuto deve essere positivo');
  assert.equal(s.dettaglio.dividendo, 0, 'con distribuzione a zero non c’è dividendo');
});

test('la ritenuta sul dividendo è il 26% e non passa dall’IRPEF progressiva', () => {
  const s = soc(run({mixMode: 'manual', revenue: 300000, distribution: 100, extractionMode: 'dividend'}));
  const aliquota = s.dettaglio.ritenuta / s.dettaglio.dividendo;
  assert.ok(Math.abs(aliquota - 0.26) < 1e-9, `ritenuta al ${(aliquota * 100).toFixed(2)}%, attesa 26%`);
});

test('la quota di partecipazione scala utile attribuibile e dividendo', () => {
  const piena = soc(run({mixMode: 'manual', revenue: 300000, ownership: 100, extractionMode: 'dividend'}));
  const meta = soc(run({mixMode: 'manual', revenue: 300000, ownership: 50, extractionMode: 'dividend'}));
  assert.ok(Math.abs(meta.dettaglio.dividendo * 2 - piena.dettaglio.dividendo) < 0.01,
    'il dividendo deve essere proporzionale alla quota');
  assert.ok(Math.abs(meta.dettaglio.baseCassa * 2 - piena.dettaglio.baseCassa) < 0.01,
    'la base contributiva deve essere proporzionale alla quota');
});

/* ---- 6. i contributi sono deducibili dal reddito complessivo ----------- */

test('l’eccedenza dei contributi trova capienza negli altri redditi', () => {
  /* Con compensi molto bassi i contributi minimi superano il reddito
     professionale. Prima della correzione l'eccedenza si perdeva; ora deduce
     dagli altri redditi, quindi il netto con altri redditi capienti è
     migliore di quello senza. */
  const senza = ord(run({revenue: 3000, previousRevenue: 0, otherIncome: 0}));
  const con = ord(run({revenue: 3000, previousRevenue: 0, otherIncome: 45000}));
  assert.ok(con.netto > senza.netto,
    `con altri redditi capienti il netto deve migliorare: ${senza.netto.toFixed(0)} vs ${con.netto.toFixed(0)}`);
});

test('la deduzione non supera il reddito complessivo', () => {
  const s = ord(run({revenue: 1000, previousRevenue: 0, otherIncome: 0}));
  assert.ok(s.dettaglio.contributiDedotti <= s.dettaglio.utile + 0.01 + BASE.otherIncome,
    'la deduzione non può eccedere il reddito su cui si applica');
});

/* ---- 7. costi: cassa, deduzione, tetti, uso professionale -------------- */

test('nel forfettario il costo che esce di cassa è lordo di IVA', () => {
  const r = run({revenue: 100000}, {tecnologia: 10000});
  /* IVA al 22% su 10.000: il forfettario non la detrae, quindi di cassa
     escono 12.200. Sommare il solo netto lo farebbe sembrare più conveniente
     di quanto è. */
  assert.ok(Math.abs(r.totali.lordo - 12200) < 0.01,
    `costo di cassa ${r.totali.lordo.toFixed(2)}, atteso 12.200`);
});

test('l’ordinario deduce il costo e l’IVA non detraibile, non l’IVA detratta', () => {
  const r = run({revenue: 100000}, {tecnologia: 10000});
  assert.ok(Math.abs(r.totali.cassaOrd - 10000) < 0.01,
    `con IVA interamente detraibile il costo di cassa è il netto: ${r.totali.cassaOrd.toFixed(2)}`);
  assert.ok(Math.abs(r.totali.dedOrd - 10000) < 0.01, 'e la deduzione coincide');
});

test('il tetto sulle spese di rappresentanza limita la deduzione', () => {
  const r = run({revenue: 120000}, {rappresentanza: 20000});
  const tetto = 0.01 * 120000;
  assert.ok(Math.abs(r.totali.dedOrd - tetto) < 0.01,
    `deduzione ${r.totali.dedOrd.toFixed(2)}, atteso il tetto ${tetto.toFixed(2)}`);
});

test('la quota di uso personale esce di cassa ma non entra nel confronto', () => {
  const pieno = run({revenue: 100000}, {tecnologia: 10000});
  const meta = cfEngine({...BASE, revenue: 100000,
    costs: CF_COSTI_DEFAULT.map(d => ({...d, amount: d.id === 'tecnologia' ? 10000 : 0,
      gross: false, uso: d.id === 'tecnologia' ? 0.5 : d.uso}))});
  assert.ok(Math.abs(meta.totali.dedOrd - pieno.totali.dedOrd / 2) < 0.01,
    'con uso professionale al 50% la deduzione si dimezza');
});

test('costi nulli ed elevati non rompono il confronto', () => {
  for (const [etichetta, importi] of [['nulli', {}],
                                      ['elevati', {studio: 90000, personale: 120000, servizi: 60000}]]) {
    const r = run({revenue: 150000, previousRevenue: 80000}, importi);
    r.scenari.forEach(s => assert.ok(Number.isFinite(s.netto),
      `costi ${etichetta}: il netto di ${s.id} non è un numero finito`));
  }
});

/* ---- 8. le due professioni --------------------------------------------- */

test('la professione determina la Cassa e la forma societaria confrontata', () => {
  const c = run({profession: 'commercialista', revenue: 150000});
  const a = run({profession: 'avvocato', revenue: 150000});
  assert.equal(soc(c).nome, 'STP S.r.l.');
  assert.equal(soc(a).nome, 'STA S.r.l.');
  assert.notEqual(Math.round(ord(c).contributi), Math.round(ord(a).contributi),
    'CNPADC e Cassa Forense non possono dare lo stesso contributo sullo stesso reddito');
});

test('Cassa Forense: 17% fino a 130.000 e 3% sull’eccedenza', () => {
  const f = CF_PARAMS[2026].forense;
  const s = ord(run({profession: 'avvocato', revenue: 200000, previousRevenue: 190000}));
  const atteso = f.sogliaSoggettivo * f.soggettivo + (200000 - f.sogliaSoggettivo) * f.oltreSoglia;
  assert.ok(Math.abs(s.contributi - atteso) < 1,
    `contributi ${s.contributi.toFixed(2)}, atteso ${atteso.toFixed(2)}`);
});

test('CNPADC: il massimale limita la base del contributo soggettivo', () => {
  const c = CF_PARAMS[2026].cnpadc;
  const s = ord(run({revenue: 400000, previousRevenue: 300000, pensionRate: 12}));
  const atteso = c.massimale * 0.12;
  assert.ok(Math.abs(s.contributi - atteso) < 1,
    `contributi ${s.contributi.toFixed(2)}, atteso ${atteso.toFixed(2)} (massimale ${c.massimale})`);
});

test('i minimi di Cassa si applicano quando il reddito è basso', () => {
  const s = ord(run({revenue: 5000, previousRevenue: 3000}));
  assert.ok(s.contributi >= CF_PARAMS[2026].cnpadc.minimoSoggettivo,
    'sotto il minimo si versa il minimo');
});

/* ---- 9. i parametri per anno ------------------------------------------- */

test('un anno non previsto viene rifiutato invece di ereditare i parametri', () => {
  assert.throws(() => run({year: 2024}), /non previsto/,
    'un anno senza tabella deve fermare il calcolo, non usare i numeri di un altro anno');
});

test('gli anni previsti hanno parametri distinti', () => {
  assert.notDeepEqual(CF_PARAMS[2026].scaglioni, CF_PARAMS[2025].scaglioni,
    'gli scaglioni IRPEF del 2026 e del 2025 non coincidono');
  assert.notEqual(CF_PARAMS[2026].inps.massimale, CF_PARAMS[2025].inps.massimale);
  assert.notEqual(CF_PARAMS[2026].forense.soggettivo, CF_PARAMS[2025].forense.soggettivo);
});

test('ogni anno dichiara l’insieme completo dei parametri', () => {
  const chiavi = ['coefficiente', 'sostitutivaOrdinaria', 'sostitutivaStartup',
    'sogliaPermanenza', 'sogliaCessazioneImmediata', 'sogliaLavoroDipendente',
    'sogliaSpesePersonale', 'scaglioni', 'forense', 'cnpadc', 'inps', 'ires',
    'ritenutaDividendo'];
  for (const anno of Object.keys(CF_PARAMS)) {
    for (const k of chiavi) {
      assert.ok(CF_PARAMS[anno][k] != null, `${anno}: manca il parametro ${k}`);
    }
  }
});

test('ogni parametro ha una fonte dichiarata in pagina', () => {
  assert.ok(CF_FONTI.length >= 6, 'le fonti dichiarate sono troppo poche');
  for (const [tema, titolo, url] of CF_FONTI) {
    assert.ok(tema && titolo, 'una fonte senza tema o titolo non è verificabile');
    assert.match(url, /^https:\/\//, `la fonte «${tema}» non ha un URL https`);
  }
});

/* ---- 10. l’IRAP non tocca la persona fisica ---------------------------- */

test('il professionista non paga IRAP; la società sì', () => {
  const r = run({revenue: 200000, previousRevenue: 150000, irapRate: 3.9});
  assert.match(ord(r).stato, /IRAP non dovuta/);
  assert.ok(soc(r).dettaglio.irap > 0, 'la società con base positiva deve avere IRAP');
  const senza = run({revenue: 200000, previousRevenue: 150000, irapRate: 0});
  assert.equal(soc(senza).dettaglio.irap, 0, 'ad aliquota zero l’IRAP è zero');
});


/* ---- 11. il re-audit del 22 agosto 2026 -------------------------------- */

/* RE-001. Il difetto bloccante: `cfNum(input.costFactor, 0, 100) || 1` faceva
   diventare 1 il fattore zero, perche' in JavaScript `0 || 1` fa 1. La soglia di
   pareggio dei costi apre chiedendo «e se non avessi nessun costo?», quindi
   rispondeva sull'ipotesi opposta. Il caso dimostrativo mostrava zero al posto
   di 52.334,66. */

const DEMO = { studio: 14000, utenze: 3200, telefonia: 1400, tecnologia: 4800,
  assicurazioni: 2200, formazione: 1800, servizi: 6500, auto: 7200,
  trasferte: 2600, rappresentanza: 1500, banca: 700, ordine: 900 };

const casoDemo = (over = {}) => cfEngine({
  ...BASE, profession: 'commercialista', currentRegime: 'forfettario',
  revenue: 90001, previousRevenue: 84000, otherIncome: 15000,
  ownership: 100, distribution: 70, admin: 40000, extractionMode: 'mix',
  companyOverhead: 6000, ...over, costs: costi(DEMO)
});

test('il fattore di costo zero produce costi zero, non costi pieni', () => {
  assert.equal(casoDemo({costFactor: 0}).totali.lordo, 0,
    'con fattore 0 i costi devono essere zero: era il difetto RE-001');
  const pieni = casoDemo().totali.lordo;
  assert.ok(Math.abs(casoDemo({costFactor: 1}).totali.lordo - pieni) < 0.005,
    'con fattore 1 i costi sono quelli inseriti');
  assert.ok(Math.abs(casoDemo({costFactor: 0.5}).totali.lordo - pieni / 2) < 0.005,
    'il fattore scala i costi in proporzione');
  assert.ok(Math.abs(casoDemo({costFactor: 8}).totali.lordo - pieni * 8) < 0.005,
    'il fattore vale anche verso l’alto');
  assert.ok(casoDemo({costFactor: 1e-12}).totali.lordo < 1e-6,
    'un fattore infinitesimo non deve tornare a uno');
});

test('senza fattore dichiarato i costi restano quelli inseriti', () => {
  const pieni = casoDemo().totali.lordo;
  for (const assente of [undefined, null, '', NaN]) {
    assert.ok(Math.abs(casoDemo({costFactor: assente}).totali.lordo - pieni) < 0.005,
      `costFactor ${String(assente)} deve valere «non dichiarato», quindi costi pieni`);
  }
});

test('la soglia di pareggio dei costi non è zero quando i costi contano', () => {
  /* La stessa ricerca che fa convenienza() nella pagina: se `delta(0)` non e'
     davvero «zero costi», la scorciatoia mette la soglia a zero e non cerca. */
  const delta = (f) => {
    const sc = casoDemo({costFactor: f}).scenari;
    return sc[1].netto - sc[0].netto;
  };
  assert.ok(delta(0) < 0,
    'a costi zero il forfettario deve vincere: se non è così, lo zero non è zero');
  assert.ok(delta(1) > 0, 'ai costi attuali l’ordinario è avanti nel caso dimostrativo');
  let lo = 0, hi = 8;
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (delta(m) >= 0) hi = m; else lo = m; }
  const soglia = casoDemo().totali.lordo * hi;
  assert.ok(Math.abs(soglia - 52334.66) < 1,
    `la soglia deve essere circa 52.334,66, calcolata ${soglia.toFixed(2)}`);
});

/* RE-003. Il massimale erogabile riduceva il compenso amministratore in
   silenzio: il risultato era costruito su un dato che l'utente non aveva
   inserito e non poteva leggere. */

test('il compenso amministratore ridotto dal massimale è rintracciabile', () => {
  const d = casoDemo({mixMode: 'manual'}).scenari[2].dettaglio;
  assert.equal(d.compensoRichiesto, 40000, 'il richiesto deve restare esposto');
  assert.ok(d.compenso < d.compensoRichiesto, 'in questo caso il massimale morde');
  assert.equal(d.compenso, d.compensoMax, 'quando morde, si usa il massimo erogabile');
  assert.equal(d.compensoRidotto, true, 'la riduzione deve essere dichiarata');
  const piccolo = casoDemo({mixMode: 'manual', admin: 10000}).scenari[2].dettaglio;
  assert.equal(piccolo.compensoRidotto, false,
    'sotto il massimo non si deve annunciare nessuna riduzione');
  assert.equal(piccolo.compenso, 10000, 'sotto il massimo si eroga quanto chiesto');
});

/* RE-007. La soglia dei 35.000 sui redditi da lavoro dipendente dell'anno
   precedente non opera se quel rapporto e' cessato — ma l'eccezione cade se
   nell'anno arrivano redditi da un nuovo rapporto o da pensione. */

test('il rapporto di lavoro cessato disattiva la soglia dei 35.000', () => {
  const sopra = {employeeIncomePrev: 40000};
  assert.equal(forf(run(sopra)).applicabile, false,
    'oltre soglia col rapporto attivo il forfettario è escluso');
  assert.equal(forf(run({...sopra, employmentEnded: true})).applicabile, true,
    'col rapporto cessato la causa ostativa non opera');
  assert.equal(run({...sopra, employmentEnded: true}).derogaCessazione, true,
    'la deroga applicata va dichiarata nell’esito');
});

test('la deroga cade se nell’anno arrivano redditi da lavoro o pensione', () => {
  const r = run({employeeIncomePrev: 40000, employmentEnded: true,
    otherIncome: 12000, employeeIncomeCurr: 12000});
  assert.equal(forf(r).applicabile, false,
    'un nuovo rapporto nell’anno fa tornare operativa la causa ostativa');
  assert.equal(r.derogaCessazione, false, 'e non c’è nessuna deroga da dichiarare');
});

test('sotto la soglia la dichiarazione di cessazione non cambia nulla', () => {
  const a = run({employeeIncomePrev: 20000});
  const b = run({employeeIncomePrev: 20000, employmentEnded: true});
  assert.equal(forf(a).applicabile, forf(b).applicabile);
  assert.equal(b.derogaCessazione, false,
    'senza soglia superata non c’è nessuna deroga in gioco');
});

/* RE-008. Cassa Forense dimezza minimo soggettivo e integrativo per chi si e'
   iscritto prima dei 35 anni, nei primi sei anni: 1.395 e 177,50 invece di
   2.790 e 355. Per CNPADC la riduzione non e' modellata, e va dichiarata. */

test('i minimi ridotti si applicano a Cassa Forense e solo dove mordono', () => {
  const base = {profession: 'avvocato', revenue: 5000, previousRevenue: 5000};
  const interi = forf(run(base)).contributi;
  const ridotti = forf(run({...base, reducedMinimums: true})).contributi;
  assert.ok(Math.abs(interi - 2945) < 0.01,
    `minimi interi: 2.790 soggettivo + 155 integrativo, calcolati ${interi.toFixed(2)}`);
  assert.ok(Math.abs(ridotti - 1395) < 0.01,
    `minimi dimezzati: 1.395 soggettivo + 0 integrativo, calcolati ${ridotti.toFixed(2)}`);

  const alto = {profession: 'avvocato', revenue: 90000, previousRevenue: 80000};
  assert.equal(forf(run(alto)).contributi, forf(run({...alto, reducedMinimums: true})).contributi,
    'dove il calcolato supera il minimo, la riduzione non deve spostare nulla');
});

test('per il commercialista la riduzione non è applicata ma è dichiarata', () => {
  const base = {profession: 'commercialista', revenue: 5000, previousRevenue: 5000};
  assert.equal(forf(run(base)).contributi, forf(run({...base, reducedMinimums: true})).contributi,
    'senza fonte citabile per CNPADC il calcolo non cambia');
  const input = {...BASE, ...base, reducedMinimums: true, costs: costi()};
  const ids = cfAssunzioni(input, cfEngine(input)).map(a => a.id);
  assert.ok(ids.includes('minimi-ridotti-non-modellati'),
    'quello che non si calcola va detto: manca l’assunzione');
});

/* RE-011. Un elenco solo di assunzioni, letto dalla pagina e dall'Excel: erano
   due, e il working paper ne portava una parte. */

test('l’elenco delle assunzioni copre i casi che spostano il risultato', () => {
  const input = {...BASE, profession: 'commercialista', currentRegime: 'forfettario',
    revenue: 90001, previousRevenue: 84000, otherIncome: 15000, admin: 40000,
    mixMode: 'manual', extractionMode: 'mix', distribution: 70,
    companyOverhead: 6000, costs: costi(DEMO)};
  const ids = cfAssunzioni(input, cfEngine(input)).map(a => a.id);
  for (const atteso of ['compenso-ridotto', 'maternita-non-determinata', 'redditi-misti',
    'precheck-parziale', 'addizionali', 'irap-semplificata', 'costi-aggregati', 'ruleset']) {
    assert.ok(ids.includes(atteso), `manca l’assunzione ${atteso}`);
  }
  const alte = cfAssunzioni(input, cfEngine(input)).filter(a => a.severita === 'alta');
  assert.ok(alte.length >= 2, 'compenso ridotto e maternità non determinata sono ad alta severità');
});

test('una regola dei costi cambiata a mano finisce fra le assunzioni', () => {
  const tocchi = costi(DEMO).map(c => c.id === 'auto' ? {...c, dedOrd: 1} : c);
  const input = {...BASE, costs: tocchi};
  const ids = cfAssunzioni(input, cfEngine(input)).map(a => a.id);
  assert.ok(ids.includes('regole-modificate'),
    'una percentuale diversa dal default va dichiarata nel working paper');
  const intatti = {...BASE, costs: costi(DEMO)};
  assert.ok(!cfAssunzioni(intatti, cfEngine(intatti)).map(a => a.id).includes('regole-modificate'),
    'coi valori predefiniti non c’è niente da dichiarare');
});

test('la maternità non determinata è dichiarata finché resta a zero', () => {
  const zero = {...BASE, maternity: 0, costs: costi()};
  const dato = {...BASE, maternity: 120, costs: costi()};
  assert.ok(cfAssunzioni(zero, cfEngine(zero)).some(a => a.id === 'maternita-non-determinata'));
  assert.ok(!cfAssunzioni(dato, cfEngine(dato)).some(a => a.id === 'maternita-non-determinata'),
    'con un importo inserito l’avviso non serve più');
});

/* Il ruleset accompagna il risultato: senza versione e data, un working paper
   riletto fra sei mesi non e' ripercorribile. */

test('ogni risultato porta la versione delle regole', () => {
  const r = run();
  assert.match(r.ruleset.versione, /^\d+\.\d+\.\d+$/, 'la versione deve essere leggibile');
  assert.match(r.ruleset.aggiornato, /^\d{4}-\d{2}-\d{2}$/, 'e datata');
  assert.equal(r.ruleset, CF_RULESET, 'una sola fonte per la versione');
});

/* Le voci di costo escono con la regola applicata, non solo con l'importo: e'
   quello che rende il foglio «Costi» ricostruibile riga per riga. */

test('ogni voce di costo espone dedotto, limite e tetto applicato', () => {
  const r = casoDemo();
  const rappresentanza = r.totali.voci.find(v => v.id === 'rappresentanza');
  assert.ok(rappresentanza, 'la voce rappresentanza deve esserci');
  assert.ok(rappresentanza.limite > 0, 'ha un tetto sui compensi, quindi un limite in euro');
  assert.equal(rappresentanza.tettoApplicato, true,
    'a 1.500 su 90.001 di compensi il tetto dell’1% morde: 900,01');
  assert.ok(rappresentanza.dedottoOrd <= rappresentanza.limite + 1e-9,
    'il dedotto non può superare il tetto');
  const affitto = r.totali.voci.find(v => v.id === 'studio');
  assert.equal(affitto.limite, null, 'una voce senza tetto dichiara limite nullo');
  assert.equal(affitto.tettoApplicato, false, 'e nessun tetto applicato');
  const somma = r.totali.voci.reduce((a, v) => a + v.dedottoOrd, 0);
  assert.ok(Math.abs(somma - r.totali.dedOrd) < 0.005,
    'la somma delle righe deve fare il totale: altrimenti il foglio non riconcilia');
});


/* ---- 12. l’ottimizzazione automatica del mix STA/STP -------------------- */

/* La pagina prometteva già «il tool cerca il mix migliore» sulla terza opzione,
   ma nel motore non c'era nessuna ricerca: quella modalità usava il compenso e
   la percentuale inseriti a mano. Questi test bloccano la promessa.

   Cosa massimizza: il netto personale disponibile, con il vincolo dichiarato su
   quanto deve restare in società. Senza vincolo l'ottimo distribuisce tutto,
   perché l'utile trattenuto non arriva alla persona e nella metrica non conta. */

const mixDemo = (over = {}) => cfEngine({
  ...BASE, profession: 'commercialista', currentRegime: 'forfettario',
  revenue: 120000, previousRevenue: 84000, otherIncome: 15000,
  ownership: 100, distribution: 70, admin: 40000, extractionMode: 'mix',
  companyOverhead: 6000, ...over, costs: costi(DEMO)
});

test('nessun mix impostato a mano batte quello scelto dall’ottimizzatore', () => {
  const auto = mixDemo().scenari[2];
  let migliore = -Infinity, dove = null;
  for (let c = 0; c <= 130000; c += 500) {
    const n = mixDemo({mixMode: 'manual', extractionMode: 'mix', admin: c, distribution: 100})
      .scenari[2].netto;
    if (n > migliore) { migliore = n; dove = c; }
  }
  assert.ok(auto.netto >= migliore - 0.5,
    `l’automatico dà ${auto.netto.toFixed(2)} e una griglia manuale trova ${migliore.toFixed(2)} a compenso ${dove}`);
  assert.ok(Math.abs(auto.dettaglio.compenso - dove) < 600,
    `il compenso proposto (${auto.dettaglio.compenso}) deve stare vicino al massimo della griglia (${dove})`);
});

test('in automatico il compenso inserito a mano non entra nel calcolo', () => {
  const a = mixDemo({admin: 5000}).scenari[2].netto;
  const b = mixDemo({admin: 90000}).scenari[2].netto;
  assert.equal(a, b, 'due compensi manuali diversi devono dare lo stesso risultato ottimizzato');
  assert.equal(mixDemo().scenari[2].dettaglio.mix.modo, 'auto', 'la modalità va dichiarata nell’esito');
});

test('senza vincolo non resta nulla in società: non sarebbe denaro della persona', () => {
  assert.equal(mixDemo().scenari[2].trattenuto, 0);
});

test('il vincolo su quanto resta in società viene rispettato', () => {
  const v = mixDemo({retainInCompany: 20000}).scenari[2];
  assert.ok(Math.abs(v.trattenuto - 20000) < 1,
    `chiesti 20.000 in società, trattenuti ${v.trattenuto.toFixed(2)}`);
  assert.ok(v.netto < mixDemo().scenari[2].netto,
    'trattenere in società costa netto personale: se non costasse, il vincolo non servirebbe');
  assert.equal(v.dettaglio.mix.limitatoDalVincolo, true,
    'il vincolo che morde va dichiarato');
});

test('un vincolo più grande dell’utile disponibile è dichiarato irrealizzabile', () => {
  const v = mixDemo({retainInCompany: 9999999}).scenari[2];
  assert.equal(v.dettaglio.dividendo, 0, 'non si distribuisce nulla');
  assert.ok(Math.abs(v.trattenuto - v.dettaglio.distribuibile) < 1,
    'resta in società tutto il distribuibile');
  assert.equal(v.dettaglio.mix.vincoloIrrealizzabile, true);
});

test('l’ottimizzatore è deterministico', () => {
  assert.equal(JSON.stringify(mixDemo().scenari[2]), JSON.stringify(mixDemo().scenari[2]));
});

test('la modalità manuale continua a fare quello che l’utente chiede', () => {
  const m = mixDemo({mixMode: 'manual', admin: 30000, distribution: 50}).scenari[2];
  assert.equal(m.dettaglio.mix.modo, 'manuale');
  assert.equal(m.dettaglio.compensoRichiesto, 30000);
  assert.ok(m.dettaglio.compenso === 30000 || m.dettaglio.compensoRidotto,
    'o eroga quanto chiesto, o dichiara di averlo ridotto');
  assert.ok(m.trattenuto > 0, 'con metà utile non distribuito qualcosa resta in società');
  assert.ok(m.netto <= mixDemo().scenari[2].netto + 0.5,
    'e non può battere l’ottimo, altrimenti l’ottimo non è ottimo');
});


/* ---- 13. l’audit del 23 agosto 2026: riconciliazione e soglie ----------- */

/* Il rilievo era «il netto della STP è duplicato da quello dell’ordinario»,
   con diagnosi di binding incrociato nel rendering. La diagnosi era sbagliata —
   la card è costruita in un map sullo stesso oggetto scenario, un incrocio non è
   possibile — ma il numero era giusto, e la causa era peggiore.

   `compensoMax` era tutta la cassa della società: non riservava le imposte
   societarie. L’IRAP si calcola su una base che NON deduce il compenso
   amministratore, quindi è dovuta qualunque compenso si eroghi. Erogando tutto,
   l’utile distribuibile andava negativo e il `Math.max(0, ...)` lo azzerava in
   silenzio: l’IRAP restava fra le imposte esposte e non veniva sottratta dal
   netto. E siccome l’ottimo erogava tutto come compenso, la società diventava un
   passante e il netto coincideva con l’ordinario — cosa corretta in sé, che
   però nascondeva il buco.

   Il caso: commercialista, 195.000 di compensi, 44.000 di costi, CNPADC al 12%.
   La card mostrava 80.844 con 76.045 di imposte e contributi: 195.000 − 44.000 −
   76.045 fa 74.955, e lo scarto di 5.889 era esattamente l’IRAP. */

const AUDIT = {
  ...BASE, profession: 'commercialista', currentRegime: 'ordinario',
  revenue: 195000, previousRevenue: 195000, otherIncome: 0,
  ownership: 100, distribution: 100, admin: 0, extractionMode: 'dividend',
  companyOverhead: 0, pensionRate: 12, irapRate: 3.9, mixMode: 'auto', retainInCompany: 0
};
const soloAffitto = (importo) => CF_COSTI_DEFAULT.map(d =>
  ({...d, amount: d.id === 'studio' ? importo : 0, gross: false}));

/* La riconciliazione, come funzione: è l’invariante che l’audit chiede al
   paragrafo 25. Per il forfettario e per l’ordinario è il conto del
   professionista; per la società è il ponte dal lato del socio, perché il
   compenso amministratore gli è erogato per intero mentre il dividendo è pro
   quota, quindi le voci scalate alla quota non possono quadrare. */
function riconcilia(scenario, input) {
  if (scenario.id === 'societa') {
    const d = scenario.dettaglio;
    return d.erogatoLordo - d.impostePersonali - d.contributiPersonali;
  }
  return input.revenue - scenario.costi - (scenario.imposte + scenario.contributi)
    - scenario.trattenuto;
}

test('il caso dell’audit riconcilia in tutti e tre gli scenari', () => {
  const input = {...AUDIT, costs: soloAffitto(44000)};
  const r = cfEngine(input);
  for (const s of r.scenari) {
    assert.ok(Math.abs(riconcilia(s, input) - s.netto) < 0.51,
      `${s.nome}: la card mostrerebbe ${riconcilia(s, input).toFixed(2)} e il netto è ${s.netto.toFixed(2)}`);
  }
  /* L’ordinario è il valore osservato nell’audit, ed era già corretto. */
  assert.ok(Math.abs(r.scenari[1].netto - 80844) < 1,
    `netto ordinario ${r.scenari[1].netto.toFixed(2)}, atteso circa 80.844`);
  /* La società ora paga l’IRAP che prima svaniva: il netto scende sotto quello
     dell’ordinario, che l’IRAP non la paga. */
  assert.ok(r.scenari[2].netto < r.scenari[1].netto,
    'la società sconta l’IRAP, quindi non può lasciare più netto dell’ordinario a parità di tutto');
});

test('la società non eroga la cassa che le serve per le proprie imposte', () => {
  const input = {...AUDIT, costs: soloAffitto(44000)};
  const d = cfEngine(input).scenari[2].dettaglio;
  assert.ok(d.distribuibile >= -0.01,
    `l’utile distribuibile non può essere negativo: ${d.distribuibile.toFixed(2)}`);
  assert.ok(d.compenso <= d.compensoMax + 0.01, 'il compenso resta nel massimo erogabile');
  assert.ok(d.compensoMax < d.tettoContributivo,
    'con IRAP dovuta il tetto di capienza deve mordere prima di quello contributivo');
  assert.ok(d.irap > 0, 'in questo caso l’IRAP è dovuta');
});

test('ogni scenario riconcilia su una matrice di casi', () => {
  const casi = [
    ['audit', {revenue: 195000, previousRevenue: 195000}, 44000],
    ['quota 50%', {revenue: 195000, previousRevenue: 195000, ownership: 50}, 44000],
    ['quota 30% con struttura', {revenue: 195000, previousRevenue: 195000, ownership: 30, companyOverhead: 12000}, 44000],
    ['con trattenuta', {revenue: 195000, previousRevenue: 195000, retainInCompany: 20000}, 44000],
    ['manuale dividendo', {revenue: 195000, previousRevenue: 195000, mixMode: 'manual', extractionMode: 'dividend'}, 44000],
    ['manuale misto', {revenue: 195000, previousRevenue: 195000, mixMode: 'manual', extractionMode: 'mix', admin: 60000, distribution: 50}, 44000],
    ['costi oltre i compensi', {revenue: 60000, previousRevenue: 60000}, 70000],
    ['avvocato', {revenue: 120000, previousRevenue: 120000, profession: 'avvocato'}, 20000],
    ['costi bassissimi', {revenue: 85000, previousRevenue: 80000}, 2000],
    ['costi alti', {revenue: 85000, previousRevenue: 80000}, 45000],
    ['start-up al 5%', {revenue: 85000, previousRevenue: 40000, startup: true}, 10000],
    ['Gestione Separata', {revenue: 195000, previousRevenue: 195000, adminTreatment: 'inps', inpsRate: 24}, 44000]
  ];
  for (const [nome, over, importoCosti] of casi) {
    const input = {...AUDIT, ...over, costs: soloAffitto(importoCosti)};
    const r = cfEngine(input);
    for (const s of r.scenari) {
      const atteso = riconcilia(s, input);
      assert.ok(Math.abs(atteso - s.netto) < 0.51,
        `${nome} · ${s.nome}: riconciliazione ${atteso.toFixed(2)} contro netto ${s.netto.toFixed(2)}`);
    }
    assert.ok(r.scenari[2].dettaglio.distribuibile >= -0.01,
      `${nome}: utile distribuibile negativo`);
  }
});

/* La soglia: 100.000 esatti non sono «oltre 100.000». L’audit chiede la matrice
   completa, e i due estremi mancavano. */
test('la matrice delle soglie del forfettario', () => {
  const casi = [
    [84999, true, false], [85000, true, false], [85001, true, true],
    [99999, true, true], [100000, true, true], [100001, false, false],
    [120000, false, false]
  ];
  for (const [revenue, applicabile, uscitaDopo] of casi) {
    const r = run({revenue, previousRevenue: 40000});
    assert.equal(forf(r).applicabile, applicabile,
      `a ${revenue} il forfettario dovrebbe ${applicabile ? 'essere' : 'non essere'} applicabile`);
    if (applicabile) {
      const dice = /periodo successivo/.test(forf(r).stato);
      assert.equal(dice, uscitaDopo,
        `a ${revenue} lo stato ${dice ? 'annuncia' : 'non annuncia'} l’uscita dal periodo successivo`);
    }
  }
});

/* L’ottimizzatore deve reagire ai compensi: un mix che non cambia mai è un
   ottimizzatore che non ottimizza. */
test('il mix ottimale cambia col livello dei compensi', () => {
  const mix = (revenue) => {
    const d = cfEngine({...AUDIT, revenue, previousRevenue: revenue, costs: soloAffitto(40000)})
      .scenari[2].dettaglio;
    return {compenso: d.compenso, dividendo: d.dividendo};
  };
  const a = mix(150000), b = mix(200000), c = mix(250000);
  assert.notDeepEqual(a, b, 'da 150.000 a 200.000 il mix deve poter cambiare');
  assert.notDeepEqual(b, c, 'da 200.000 a 250.000 il mix deve poter cambiare');
  assert.ok(b.compenso > a.compenso, 'con più compensi la società può erogare di più');
});

/* Il vincolo di trattenuta: più si lascia in società, meno arriva alla persona. */
test('il netto personale scende al crescere di quanto resta in società', () => {
  const netto = (trattieni) => cfEngine({...AUDIT, retainInCompany: trattieni,
    costs: soloAffitto(40000)}).scenari[2].netto;
  const a = netto(0), b = netto(20000), c = netto(50000);
  assert.ok(b < a, `con 20.000 in società il netto (${b.toFixed(0)}) deve scendere sotto ${a.toFixed(0)}`);
  assert.ok(c < b, `con 50.000 in società il netto (${c.toFixed(0)}) deve scendere sotto ${b.toFixed(0)}`);
});

/* Le due Casse non devono condividere formule. */
test('avvocato e commercialista non usano gli stessi parametri', () => {
  const comune = {revenue: 120000, previousRevenue: 120000, costs: soloAffitto(20000)};
  const av = cfEngine({...AUDIT, ...comune, profession: 'avvocato'});
  const co = cfEngine({...AUDIT, ...comune, profession: 'commercialista'});
  assert.notEqual(forf(av).contributi, forf(co).contributi,
    'le due Casse hanno aliquote e minimi diversi: i contributi non possono coincidere');
  assert.equal(av.scenari[2].nome, 'STA S.r.l.');
  assert.equal(co.scenari[2].nome, 'STP S.r.l.');
});

/* L’aliquota soggettiva CNPADC è una scelta dell’iscritto: deve muovere il
   risultato. */
test('l’aliquota soggettiva CNPADC muove contributi e netto', () => {
  const prova = (aliquota) => {
    const r = cfEngine({...AUDIT, pensionRate: aliquota, costs: soloAffitto(40000)});
    return {contributi: ord(r).contributi, netto: ord(r).netto};
  };
  const a = prova(12), b = prova(15), c = prova(20);
  assert.ok(b.contributi > a.contributi && c.contributi > b.contributi,
    'più alta l’aliquota, più alti i contributi');
  assert.ok(b.netto < a.netto && c.netto < b.netto,
    'e più bassa la cassa che resta, a parità di tutto il resto');
});
