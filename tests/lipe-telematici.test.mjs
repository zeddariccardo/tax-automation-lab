/* I campi telematici di LIPE: che la correzione resti dov'è.
 *
 * Fase 1.5, 28 agosto 2026. Le regole vere — quelle che dicono quando un campo
 * è obbligatorio e che forma deve avere — sono provate contro lo schema XSD
 * ufficiale dell'Agenzia nel repository privato, dove i file dello schema sono
 * archiviati con la loro impronta. Questo file fa la guardia qui, dove il
 * codice è pubblicato, e sorveglia le tre cose che da lì non si vedono.
 *
 * PRIMA: `buildXml` scriveva `UltimoMese` con lo zero davanti — `03` — e i
 * valori ammessi dal tracciato sono da 1 a 13 e 99, senza zeri. È un controllo
 * di validazione: l'Agenzia scarta l'intera fornitura. Lo zero è giusto sul
 * modello cartaceo, dove le caselle sono due, e lì infatti resta.
 *
 * LA TRAPPOLA: in questo file `buildXml` è definita quattro volte in
 * successione, e vale l'ultima. Correggere una delle prime non cambia niente e
 * sembra fatto. Per questo i controlli qui sotto guardano il testo che segue la
 * definizione delle regole, non il file intero.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'tools', 'lipe', 'index.html'), 'utf8');

/* Il codice vivo: dalla definizione delle regole in poi. Le tre versioni morte
   di buildXml stanno tutte prima. */
const inizioRegole = html.indexOf('function ivp18Telematici');
const vivo = inizioRegole >= 0 ? html.slice(inizioRegole) : '';

test('le regole telematiche esistono, una volta sola, e qualcuno le chiama', () => {
  const definizioni = html.match(/function ivp18Telematici\s*\(/g) || [];
  assert.equal(definizioni.length, 1,
    'ivp18Telematici deve essere definita una volta sola: due versioni della stessa regola ' +
    'un giorno smettono di essere d’accordo, ed è già successo con pct');
  assert.match(vivo, /ivp18Telematici\(c,\{piva:/,
    'la definizione viva di buildXml non chiama più le regole: la correzione è scollegata');
});

test('l’XML vivo prende i tag dalle regole, non li assembla per conto suo', () => {
  assert.match(vivo, /var front=tele\.frontespizio\.map\(/,
    'il frontespizio deve venire da tele.frontespizio');
  assert.match(vivo, /tele\.intestazione\.map\(/,
    'anche l’intestazione: prima scriveva c.repCf comunque, anche vuoto');
  assert.doesNotMatch(vivo, /xmlTag\('CFDichiarante'/,
    'nessun tag del frontespizio va più scritto a mano nella versione viva');
});

test('UltimoMese esce senza zero iniziale', () => {
  assert.doesNotMatch(vivo, /UltimoMese[^\n]{0,80}padStart/,
    'nel codice vivo UltimoMese non deve più passare da padStart: «03» non è un valore ammesso ' +
    'e fa scartare l’intera fornitura');
  assert.match(vivo, /fronte\.push\(\['UltimoMese', String\(umN\)\]\)/,
    'il valore va scritto come numero puro');
});

test('sul modello cartaceo lo zero davanti resta, ed è giusto', () => {
  /* Il PDF disegna il modello dell’Agenzia, dove «Ultimo mese» ha due caselle:
     lì «03» è la forma corretta. La correzione riguarda l’XML, non la carta. */
  assert.match(html, /writeModelBoxes\(doc,String\(c\.lastMonth\)\.padStart\(2,'0'\)/,
    'il modello stampato deve continuare a riempire due caselle');
});

test('il CF della società dichiarante chiede undici cifre, non sedici caratteri', () => {
  assert.match(html, /<input id="cfg-decl-company-cf"[^>]*maxlength="11"/,
    'il campo deve smettere di accettare sedici caratteri');
  assert.match(vivo, /IVP18_CF11\.test\(soc\)/,
    'e la validazione deve pretendere il tipo numerico dello schema');
});

test('l’aiuto dell’identificativo produttore software non lo chiama più codice fiscale', () => {
  const aiuto = /Nel tracciato IVP18 questo campo identifica[\s\S]{0,900}?<\/div>/.exec(html);
  assert.ok(aiuto, 'non trovo più il testo di aiuto del produttore software');
  assert.doesNotMatch(aiuto[0], /è un codice fiscale di 11 cifre/,
    'le specifiche non lo dicono: è «un elemento opzionale che espone un identificativo ' +
    'del produttore di software», di tipo alfanumerico');
  assert.match(aiuto[0], /elemento opzionale/,
    'il testo deve dire quello che dice la fonte');
  assert.match(aiuto[0], /non ne inserisce uno/,
    'e deve restare scritto che il tool non lo valorizza da solo');
});

test('l’etichetta dell’impegno usa il testo ufficiale', () => {
  assert.match(html, /2 · predisposta da chi effettua l’invio/,
    'le specifiche dicono «predisposta da chi effettua l’invio», non «dall’intermediario»');
});
