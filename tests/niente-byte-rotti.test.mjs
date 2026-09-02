/* Nessun byte di controllo dentro i file che il browser deve leggere.
 *
 * Il 28 agosto 2026 nella pagina di LIPE c'era un byte NUL, dentro un
 * `content:` del CSS: `content:"\0b7"`. Sullo schermo diventava un carattere
 * rotto seguito da «b7», nel punto peggiore — il separatore del riepilogo
 * cliente, cioè una riga che si legge dopo ogni caricamento di file.
 *
 * COME CI È FINITO. L'escape CSS di U+00B7 si scrive `\00b7`. Scritto dentro
 * una stringa Python non-raw, `\00` è l'escape ottale del NUL: al posto
 * dell'escape CSS è finito un byte zero seguito dal testo `b7`.
 *
 * PERCHÉ NESSUN TEST L'AVEVA VISTO. I test leggono il file come testo e
 * cercano parole; un NUL non è una parola. E nel browser il contenuto di uno
 * pseudo-elemento non sta nell'albero del testo, quindi nemmeno le scansioni
 * del DOM lo trovavano. L'unico segnale c'era da giorni, e non l'avevo letto:
 * `grep` rispondeva «Binary file index.html matches».
 *
 * Questo test guarda i byte, non le parole.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { trackedFiles } from './tracked-files.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function testuali(cartella) {
  return trackedFiles(cartella, {
    exclude: ['legal-docs'],
    pattern: /\.(html|css|js|mjs|json|txt|md|svg|xml)$/i
  });
}

const file = testuali(root);

test('nessun file di testo contiene byte NUL', () => {
  const sporchi = [];
  for (const f of file) {
    const d = fs.readFileSync(f);
    const i = d.indexOf(0);
    if (i >= 0) {
      sporchi.push(`${path.relative(root, f)} · byte ${i} · contesto: ` +
        JSON.stringify(d.slice(Math.max(0, i - 40), i + 10).toString('latin1')));
    }
  }
  assert.deepStrictEqual(sporchi, [],
    'un byte NUL in un file servito al browser diventa un carattere rotto sullo schermo:\n' +
    sporchi.join('\n'));
});

test('nel testo che scriviamo noi non ci sono byte di controllo', () => {
  /* Non su tutto il file: le librerie di terze parti ne contengono
     legittimamente — SheetJS porta dentro le tabelle dei codepage, che sono
     byte da 0x01 in su. Qui si guarda solo quello che scriviamo noi: il markup
     e i blocchi <style>, cioè i posti da cui un escape sbagliato arriva sullo
     schermo. */
  const lipe = fs.readFileSync(path.join(root, 'tools', 'lipe', 'index.html'));
  const testo = lipe.toString('utf8');
  /* Prima si tolgono gli script, poi si guarda quello che resta: dentro jsPDF
     ci sono stringhe che assomigliano a un tag <style>, e cercarli sul file
     intero porta a leggere i dati binari di un font. */
  const senzaScript = testo.replace(/<script[\s\S]*?<\/script>/g, ' ');
  const nostri = [];
  for (const m of senzaScript.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) nostri.push(['uno <style>', m[1]]);
  nostri.push(['il markup', senzaScript.replace(/<style[\s\S]*?<\/style>/g, ' ')]);

  const ammessi = new Set([9, 10, 13]);
  const sporchi = [];
  for (const [dove, pezzo] of nostri) {
    for (let i = 0; i < pezzo.length; i++) {
      const c = pezzo.charCodeAt(i);
      if (c < 32 && !ammessi.has(c)) {
        sporchi.push(`${dove}: 0x${c.toString(16).padStart(2, '0')} in ` +
          JSON.stringify(pezzo.slice(Math.max(0, i - 40), i + 10)));
        break;
      }
    }
  }
  assert.deepStrictEqual(sporchi, [], sporchi.join('\n'));
});

test('gli escape CSS scritti a mano non sono rimasti a metà', () => {
  /* La forma sbagliata sopravvissuta al NUL: una barra rovesciata doppia dentro
     un `content:`, che il browser stampa invece di interpretare. */
  const lipe = fs.readFileSync(path.join(root, 'tools', 'lipe', 'index.html'), 'utf8');
  for (const m of lipe.matchAll(/content:\s*"([^"]*)"/g)) {
    assert.doesNotMatch(m[1], /\\\\/,
      `content:"${m[1]}" ha una barra rovesciata doppia: il browser la stampa invece di leggerla come escape`);
    assert.doesNotMatch(m[1], /\\[0-9a-fA-F]/,
      `content:"${m[1]}" usa un escape esadecimale: scrivi il carattere vero, ` +
      'gli escape a mano sono già finiti male una volta');
  }
});
