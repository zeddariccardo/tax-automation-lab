/* Le tre home devono dire la stessa cosa in tre lingue.
 *
 * Italiano, inglese e spagnolo sono tre pagine separate. Quando si riscrive una
 * frase in italiano — e il 25 agosto 2026 ne sono state riscritte dieci — le
 * altre due restano indietro senza che niente lo segnali: nessun errore, nessun
 * avviso, solo una home inglese che dice ancora la versione vecchia.
 *
 * Qui le frasi che contano stanno scritte una accanto all'altra. Cambiare una
 * scritta vuol dire cambiare questa tabella, e la tabella non si cambia a metà.
 *
 * **Perché non un controllo automatico.** Ci ho provato: le pagine portano
 * anche un dizionario per cambiare lingua senza ricaricare, indicizzato sulla
 * frase italiana, e sembrava il posto giusto dove verificare. Non lo è: quel
 * dizionario è lo stesso per tutto il sito — 310 voci, quasi tutte di altre
 * pagine — e nella home inglese le chiavi italiane non compaiono per
 * definizione. Il primo giro di questo test segnalava 220 problemi inesistenti.
 * Una tabella scritta a mano dice meno, ma dice il vero.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const HOME = { it: 'index.html', en: 'en/index.html', es: 'es/index.html' };

/* [che cos'è, italiano, inglese, spagnolo] */
const SCRITTE = [
  ['sottotitolo del marchio',
    'Automatizza i processi fiscali e contabili ricorrenti.',
    'Automate recurring tax and accounting processes.',
    'Automatiza los procesos fiscales y contables recurrentes.'],
  ['titolo grande',
    'Processi fiscali e contabili, trasformati in <em>strumenti tecnologici</em>',
    'Tax and accounting processes, transformed into <em>technology tools</em>',
    'Procesos fiscales y contables transformados en <em>herramientas tecnológicas</em>'],
  ['sommario',
    'Non devi essere uno sviluppatore per automatizzare un processo fiscale.',
    'You do not need to be a developer to automate a tax process.',
    'No necesitas ser desarrollador para automatizar un proceso fiscal.'],
  ['sommario, seconda parte',
    'Conosci il processo. Definisci le regole. Automatizza l’esecuzione. Controlla il risultato.',
    'Know the process. Define the rules. Automate the execution. Check the result.',
    'Conoce el proceso. Define las reglas. Automatiza la ejecución. Controla el resultado.'],
  ['primo obiettivo',
    'Rendere disponibili strumenti pratici per automatizzare attività fiscali e contabili.',
    'Make practical tools available for automating tax and accounting work.',
    'Poner a disposición herramientas prácticas para automatizar actividades fiscales y contables.'],
  ['secondo obiettivo',
    'Documentare regole, controlli, assunzioni e limiti di ogni automazione.',
    'Document the rules, controls, assumptions and limits of each automation.',
    'Documentar las reglas, controles, supuestos y límites de cada automatización.'],
  ['riquadro AI',
    'Configura le automazioni con l’AI che già utilizzi',
    'Configure the automations with the AI you already use',
    'Configura las automatizaciones con la IA que ya utilizas'],
  ['riquadro strumenti',
    'Esplora le automazioni',
    'Explore the automations',
    'Explora las automatizaciones'],
  ['riquadro casi',
    'Scopri come costruire un processo fiscale in un workflow automatizzato: regole, controlli, eccezioni e risultati.',
    'See how a tax process becomes an automated workflow: rules, controls, exceptions and results.',
    'Descubre cómo convertir un proceso fiscal en un flujo automatizado: reglas, controles, excepciones y resultados.'],
  ['titolo di «Chi sono»',
    'Tax expertise e tecnologia applicate ai processi reali',
    'Tax expertise and technology applied to real processes',
    'Tax expertise y tecnología aplicadas a procesos reales'],
  ['presentazione del Lab',
    'Tax Automation Lab nasce dall’esperienza diretta nella gestione di compliance, reporting, M&amp;A e controlli fiscali',
    'Tax Automation Lab grows out of direct experience in tax compliance, reporting, M&amp;A and tax audits',
    'Tax Automation Lab nace de la experiencia directa en compliance, reporting, M&amp;A y controles fiscales'],
];

const contenuto = {};
for (const [lingua, file] of Object.entries(HOME)) {
  contenuto[lingua] = fs.readFileSync(path.join(root, file), 'utf8');
}

for (const [cosa, it, en, es] of SCRITTE) {
  test(`${cosa}: c’è in tutte e tre le lingue`, () => {
    for (const [lingua, frase] of [['it', it], ['en', en], ['es', es]]) {
      assert.ok(contenuto[lingua].includes(frase),
        `${HOME[lingua]} non contiene ${cosa}:\n  «${frase}»\n` +
        `  Se la scritta è cambiata, va cambiata in tutte e tre le home e in questa tabella.`);
    }
  });
}

test('nessuna home si è tenuta la versione vecchia', () => {
  const VECCHIE = [
    'Strumenti per automatizzare processi fiscali e contabili ricorrenti',
    'Tools for automating recurring tax and accounting processes',
    'Herramientas para automatizar procesos fiscales y contables recurrentes',
    'strumenti tecnologici verificabili', 'verifiable technology tools',
    'herramientas tecnológicas verificables',
    'Non serve essere sviluppatori', 'You do not need to be a developer to automate professional work',
    'Mettere a disposizione strumenti operativi gratuiti', 'Provide free operational tools',
    'Apri la suite operativa', 'Open the operational suite', 'Abre la suite operativa',
    'Questo laboratorio nasce dal lavoro', 'This lab grows out of my direct work',
  ];
  const male = [];
  for (const [lingua, file] of Object.entries(HOME)) {
    for (const v of VECCHIE) if (contenuto[lingua].includes(v)) male.push(`  ${file}: «${v}»`);
  }
  assert.equal(male.length, 0, `scritte vecchie rimaste:\n${male.join('\n')}`);
});

test('le tre home hanno la stessa struttura', () => {
  const misura = (html) => ({
    obiettivi: ((html.match(/lab-goals surface">[\s\S]*?<\/ul>/) || [''])[0].match(/<li>/g) || []).length,
    riquadri: (html.match(/ai-onboarding-teaser/g) || []).length,
  });
  const base = misura(contenuto.it);
  for (const lingua of ['en', 'es']) {
    const m = misura(contenuto[lingua]);
    assert.equal(m.obiettivi, base.obiettivi,
      `${HOME[lingua]}: ${m.obiettivi} obiettivi contro ${base.obiettivi} dell’italiano`);
    assert.equal(m.riquadri, base.riquadri,
      `${HOME[lingua]}: ${m.riquadri} riquadri contro ${base.riquadri} dell’italiano`);
  }
});
