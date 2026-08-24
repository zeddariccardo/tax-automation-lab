/* Cosa arriva davvero dentro un file .xlsx.
 *
 * Il 24 agosto 2026, aprendo `xl/styles.xml` di un working paper scaricato:
 * due riempimenti — quelli di sistema — e un solo carattere. Tutto quello che i
 * tool assegnano a `cell.s` (l'intestazione scura, la scala di affidabilità dei
 * KPI) **non arriva nel file**. Nemmeno `!freeze`, dichiarato in tredici punti
 * fra LIPE, F24 e Confronto regimi. Il filtro automatico invece **arriva**, ed
 * e' la cosa che di un prospetto si usa davvero: ordinare, filtrare, copiare.
 *
 * Non è un difetto dei tool: è la copia di SheetJS che incorporiamo, che in
 * scrittura ignora gli stili. Questo file lo verifica **eseguendo la libreria
 * vera estratta dal tool**, non fidandosi della documentazione — così il giorno
 * in cui si passa a una build che gli stili li scrive, il test lo dice.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function libreria() {
  const html = fs.readFileSync(path.join(root, 'tools', 'lipe', 'index.html'), 'utf8');
  const i = html.indexOf('<script data-vendored="SheetJS');
  assert.ok(i > 0, 'lipe: non trovo piu’ il tag della libreria incorporata');
  const inizio = html.indexOf('>', i) + 1;
  const fine = html.indexOf('</script>', inizio);
  const sorgente = html.slice(inizio, fine);
  /* Il pacchetto e' UMD: senza `exports`, `module` e `define` finisce nel ramo
     `make_xlsx_lib(XLSX)`, dove `XLSX` e' l'oggetto che si dichiara da solo.
     Va preso da li' e restituito — passarglielo come parametro lo fa ombra. */
  const XLSX = new Function('var XLSX={};' + sorgente + '\n;return XLSX;')();
  assert.ok(XLSX && XLSX.utils && XLSX.write, 'la libreria estratta non espone utils/write');
  return XLSX;
}

function andataERitorno(XLSX) {
  const ws = XLSX.utils.aoa_to_sheet([['Titolo'], [], ['Voce', 'Valore'], ['Attivo', 1234.5]]);
  ws['!cols'] = [{ wch: 40 }, { wch: 18 }];
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
  ws['!freeze'] = { xSplit: 0, ySplit: 3 };
  ws['!autofilter'] = { ref: 'A3:B4' };
  ws.B4.z = '#,##0.00;[Red]-#,##0.00';
  ws.A3.s = { font: { bold: true, color: { rgb: 'FFFFFFFF' } }, fill: { fgColor: { rgb: 'FF0C3341' } } };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Prova');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer', cellStyles: true });
  const riletto = XLSX.read(buf, { type: 'buffer', cellStyles: true });
  return riletto.Sheets.Prova;
}

test('la libreria incorporata scrive formati, larghezze e celle unite', () => {
  const XLSX = libreria();
  const s = andataERitorno(XLSX);
  assert.equal(s.B4.z, '#,##0.00;[Red]-#,##0.00', 'il formato numerico non sopravvive');
  assert.ok(s['!cols'] && s['!cols'][0] && (s['!cols'][0].wch || s['!cols'][0].width),
    'le larghezze di colonna non sopravvivono');
  assert.ok(s['!merges'] && s['!merges'].length === 1, 'le celle unite non sopravvivono');
  assert.ok(s['!autofilter'], 'il filtro automatico non sopravvive');
});

test('la libreria incorporata NON scrive stili né blocco riquadri', () => {
  const XLSX = libreria();
  const s = andataERitorno(XLSX);
  const riempimento = s.A3 && s.A3.s && s.A3.s.fill && s.A3.s.fill.fgColor && s.A3.s.fill.fgColor.rgb;
  const grassetto = s.A3 && s.A3.s && s.A3.s.font && s.A3.s.font.bold;

  /* Se uno di questi diventa vero, la libreria e' cambiata: allora gli stili
     che i tool gia' dichiarano cominciano a vedersi, e va rivista la nota in
     `v20VestiFoglio` e in CONTESTO.md — e finalmente si possono dare colori
     diversi alle schede di una stessa cartella. */
  assert.ok(!riempimento, 'i riempimenti ORA arrivano nel file: aggiornare CONTESTO e le note nei tool');
  assert.ok(!grassetto, 'il grassetto ORA arriva nel file: aggiornare CONTESTO e le note nei tool');
  assert.ok(!s['!freeze'], '`!freeze` ORA sopravvive: si puo’ bloccare l’intestazione');
});
