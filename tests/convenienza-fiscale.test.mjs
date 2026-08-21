/* Tax Automation Lab — Convenienza fiscale: i casi limite del motore
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
const html = fs.readFileSync(path.join(root, 'tools', 'convenienza-fiscale', 'index.html'), 'utf8');

/* ---- estrazione del motore ---------------------------------------------- */

const blocco = html.match(/<script id="cf-engine">([\s\S]*?)<\/script>/);
assert.ok(blocco, 'nella pagina non trovo <script id="cf-engine">');

const sandbox = {};
vm.createContext(sandbox);
new vm.Script(blocco[1] + '\n;({cfEngine, CF_PARAMS, CF_COSTI_DEFAULT, CF_FONTI});')
  .runInContext(sandbox);
const {cfEngine, CF_PARAMS, CF_COSTI_DEFAULT, CF_FONTI} =
  new vm.Script('({cfEngine, CF_PARAMS, CF_COSTI_DEFAULT, CF_FONTI})').runInContext(sandbox);

/* ---- un input di partenza ricco di default espliciti -------------------- */

const BASE = {
  profession: 'commercialista', year: 2026, revenue: 85000, previousRevenue: 80000,
  otherIncome: 0, employeeIncome: 0, ownership: 100, distribution: 100, admin: 0,
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
  assert.equal(forf(run({employeeIncome: 35001})).applicabile, false, 'lavoro dipendente oltre soglia');
  assert.equal(forf(run({incompatible: true})).applicabile, false, 'partecipazioni incompatibili');
  assert.equal(forf(run({employer: true})).applicabile, false, 'attività verso l’ex datore');
  assert.equal(forf(run({}, {personale: 20001})).applicabile, false, 'spese per personale oltre soglia');
  assert.equal(forf(run({}, {personale: 19999})).applicabile, true, 'sotto soglia resta applicabile');
});

/* ---- 4. il massimale limita la base, non il compenso -------------------- */

test('il massimale INPS limita la base contributiva, non il compenso amministratore', () => {
  const massimale = CF_PARAMS[2026].inps.massimale;
  const sopra = soc(run({revenue: 500000, admin: massimale + 60000, extractionMode: 'mix',
    adminTreatment: 'inps', inpsRate: 24}));
  assert.ok(sopra.dettaglio.compenso > massimale,
    `il compenso erogato (${Math.round(sopra.dettaglio.compenso)}) deve poter superare il massimale`);
  const atteso = massimale * 0.24 * (1 / 3);
  assert.ok(Math.abs(sopra.dettaglio.inpsSocio - atteso) < 1,
    `contributo del socio ${sopra.dettaglio.inpsSocio.toFixed(2)}, atteso ${atteso.toFixed(2)}: la base deve fermarsi al massimale`);
});

test('il riparto della Gestione Separata è un terzo al socio e due terzi alla società', () => {
  const s = soc(run({revenue: 400000, admin: 60000, extractionMode: 'mix',
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

test('l’utile trattenuto è mostrato a parte e non entra nella cassa personale', () => {
  const s = soc(run({revenue: 300000, distribution: 0, extractionMode: 'dividend'}));
  assert.ok(s.trattenuto > 0, 'con distribuzione a zero l’utile trattenuto deve essere positivo');
  assert.equal(s.dettaglio.dividendo, 0, 'con distribuzione a zero non c’è dividendo');
});

test('la ritenuta sul dividendo è il 26% e non passa dall’IRPEF progressiva', () => {
  const s = soc(run({revenue: 300000, distribution: 100, extractionMode: 'dividend'}));
  const aliquota = s.dettaglio.ritenuta / s.dettaglio.dividendo;
  assert.ok(Math.abs(aliquota - 0.26) < 1e-9, `ritenuta al ${(aliquota * 100).toFixed(2)}%, attesa 26%`);
});

test('la quota di partecipazione scala utile attribuibile e dividendo', () => {
  const piena = soc(run({revenue: 300000, ownership: 100, extractionMode: 'dividend'}));
  const meta = soc(run({revenue: 300000, ownership: 50, extractionMode: 'dividend'}));
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
