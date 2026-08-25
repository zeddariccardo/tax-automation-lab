/* L'altezza che si vede davvero su un telefono.
 *
 * `100vh` è l'altezza **grande**: comprende la barra del browser, che su iOS e
 * Android occupa fra 60 e 110 punti. Un elemento `position: fixed` alto `100vh`
 * finisce quindi sotto quella barra — e se è un contenitore che scorre non
 * basta scorrerlo fino in fondo, perché misura sé stesso più alto di quanto si
 * vede: gli ultimi cento punti non si raggiungono mai.
 *
 * È il difetto che Riccardo ha segnalato dal telefono il 24 agosto 2026: menu
 * laterale che «rimane fisso e non scorre», pulsanti in basso irraggiungibili.
 * Misurato a 375×812 su Analisi: menu alto 812 con 1415 punti di contenuto,
 * ultima voce a 1310.
 *
 * L'emulatore non lo riproduce — non ha barra del browser, quindi `vh` e `dvh`
 * coincidono e l'armatura responsive non l'ha mai visto. Per questo il presidio
 * è qui, sul foglio di stile: le tre regole che rendono il guscio dipendente
 * dall'altezza **dinamica** devono esserci.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const css = fs.readFileSync(path.join(root, 'assets', 'tal-app.css'), 'utf8');

/* Il blocco mobile che contiene le correzioni. */
function bloccoMobile() {
  const i = css.indexOf("/* ---------- 14-bis.");
  assert.ok(i > 0, 'tal-app.css: è sparita la sezione 14-bis sull’altezza dinamica');
  const j = css.indexOf('/* ---------- 15.', i);
  return css.slice(i, j > 0 ? j : css.length);
}

test('il menu laterale usa l’altezza dinamica, con `vh` come ripiego', () => {
  const b = bloccoMobile();
  assert.match(b, /:is\(#sidebar[^{]*\{[^}]*height:100dvh !important/s,
    'manca `height:100dvh` sul menu laterale fissato');
  assert.match(b, /:is\(#sidebar[^{]*\{[^}]*height:100vh !important;[\s\S]*?height:100dvh/s,
    'manca la riga `100vh` prima di `100dvh`: i browser che non conoscono dvh restano senza altezza');
  assert.match(b, /:is\(#sidebar[^{]*\{[^}]*padding-bottom:calc\([^)]*env\(safe-area-inset-bottom\)/s,
    'l’ultima voce del menu deve avere spazio sotto: manca la safe area');
});

test('l’area principale usa l’altezza dinamica', () => {
  const b = bloccoMobile();
  assert.match(b, /\.app-main\{[^}]*min-height:100dvh !important/s, 'manca `min-height:100dvh` su .app-main');
});

test('su telefono a scorrere è l’involucro del dialogo, non il riquadro', () => {
  const b = bloccoMobile();
  assert.match(b, /:is\(\.modal-ov[^{]*\{[^}]*overflow-y:auto !important/s,
    'l’involucro del dialogo deve scorrere');
  assert.match(b, /:is\(\.modal-ov[^{]*\{[^}]*align-items:flex-start !important/s,
    'un dialogo più alto dello schermo, centrato, sborda da tutte e due le parti');
  assert.match(b, /:is\(\.modal-ov[^{]*\)>\*\{[^}]*max-height:none !important/s,
    'i tetti in `vh` sul riquadro vanno neutralizzati: sono più alti dello schermo visibile');
});

test('le regole valgono solo su schermo piccolo', () => {
  const b = bloccoMobile();
  assert.match(b, /@media\(max-width:980px\)/, 'le correzioni devono stare dentro la media query del telefono');
  /* Nessun `!important` sull'altezza fuori dalla media query: sul desktop il
     guscio resta quello dei tool. */
  const fuori = css.slice(0, css.indexOf('/* ---------- 14-bis.'));
  assert.doesNotMatch(fuori, /height:100dvh !important/, 'l’altezza dinamica non va imposta anche sul desktop');
});
