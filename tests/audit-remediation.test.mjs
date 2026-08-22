import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');

function inlineScripts(html){
  const out=[];
  for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
    if(/\bsrc\s*=/i.test(match[1])||/application\/ld\+json/i.test(match[1]))continue;
    out.push(match[2]);
  }
  return out;
}

for(const relative of [
  'tools/financial-analysis/index.html',
  'tools/financial-statement/index.html',
  'tools/lipe/index.html',
  'tools/f24/index.html',
  'tools/tfa-client-file/index.html',
  'tools/confronto-regimi/index.html',
  'configura-con-ai/index.html',
  'en/configure-with-ai/index.html',
  'es/configura-con-ia/index.html'
]){
  const scripts=inlineScripts(read(relative));
  assert.ok(scripts.length>0,`${relative}: nessuno script inline trovato`);
  scripts.forEach((source,index)=>assert.doesNotThrow(()=>new vm.Script(source,{filename:`${relative}#script-${index+1}`})));
}

const fa=read('tools/financial-analysis/index.html');
assert.match(fa,/\['cg_inventory_products','Variazione prodotti e lavori in corso'\]/);
assert.match(fa,/\['cg_internal_work','Incrementi per lavori interni'\]/);
assert.match(fa,/\['cg_prod_da','D&A industriale allocata al costo del venduto'\]/);
assert.match(fa,/return \(g\.cg_prod_direct\|\|0\)\+\(g\.cg_prod_indirect\|\|0\)\+\(g\.cg_inventory_products\|\|0\)\+\(g\.cg_internal_work\|\|0\)\+\(g\.cg_prod_da\|\|0\)/);
assert.match(fa,/Benchmark incompleto/);
assert.match(fa,/Diagnostica crisi e continuità/);
assert.match(fa,/aria-controls/);
assert.match(fa,/id="fa-kpi-menu-clarity-style"/);
assert.match(fa,/className='sb-close-mobile'/);
assert.match(fa,/Legenda affidabilità/);
assert.match(fa,/Con assunzioni/);
assert.match(fa,/Da integrare/);
assert.doesNotMatch(fa,/class="kpi-legend"/);

const lipe=read('tools/lipe/index.html');
assert.match(lipe,/data-tool-version="3\.6\.1"/);
assert.match(lipe,/"softwareVersion":"3\.6\.1"/);
assert.match(lipe,/const APP_VERSION='3\.6\.1'/);
assert.match(lipe,/const PATCH_VERSION='3\.6\.1'/);
assert.match(lipe,/var VERSION='3\.6\.1'/);
assert.match(lipe,/xmlPushMoney\(tags,'VersamentiAutoUE',v\.vp10\)/);
assert.match(lipe,/if\(!q5\|\|sub\)xmlPushMoney\(tags,'CreditiImposta',v\.vp11\)/);
assert.match(lipe,/if\(!q5\|\|sub\)\{if\(v\.vp14deb/);
assert.match(lipe,/front\.push\(xmlTag\('FlagConferma','1',3\)\)/);
assert.match(lipe,/seqKey='IVP18_'\+transmitter/);
assert.match(lipe,/filename:'IT'\+transmitter\+'_LI_'/);
assert.match(lipe,/year===2023\?25\.82:100/);
assert.match(lipe,/PROSPETTO DI LAVORO · NON PRESENTABILE/);
assert.match(lipe,/moduleProfile:'single'/);

const f24=read('tools/f24/index.html');
assert.match(f24,/\.demo-banner\[hidden\]\{display:none!important\}/);

const tfa=read('tools/tfa-client-file/index.html');
assert.match(tfa,/id="tfa-import-layout-fix"/);
assert.match(tfa,/\.import-flow\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);

const configureAi=read('configura-con-ai/index.html');
assert.match(configureAi,/class="screen-marker"/);
assert.match(configureAi,/Bilancio civilistico ITA GAAP/);
assert.match(configureAi,/bilancio-ita-gaap-import-20260815\.png/);
assert.match(configureAi,/analisi-bilancio-import-20260815\.png/);
assert.match(configureAi,/lipe-periodo-20260815\.png/);
assert.match(configureAi,/fascicolo-importa-excel-20260815\.png/);
assert.match(configureAi,/f24-import-massivo-20260815\.png/);
assert.match(configureAi,/setupGrid\.appendChild\(f24Setup\)/);
assert.doesNotMatch(configureAi,/financial-statement-import-(?:tab|button)\.png/);

for(const relative of ['en/configure-with-ai/index.html','es/configura-con-ia/index.html']){
  const page=read(relative);
  assert.match(page,/ITA GAAP/);
  assert.match(page,/bilancio-ita-gaap-import-20260815\.png/);
  assert.match(page,/f24-import-massivo-20260815\.png/);
  assert.doesNotMatch(page,/financial-statement-import-(?:tab|button)\.png/);
}

for(const relative of ['configura-con-ai/index.html','en/configure-with-ai/index.html','es/configura-con-ia/index.html']){
  for(const match of read(relative).matchAll(/(?:src|href)="(\/resources\/[^"?#]+)[^"\s]*"/g)){
    assert.ok(fs.existsSync(path.join(root,match[1].slice(1))),`${relative}: risorsa mancante ${match[1]}`);
  }
}

console.log('Audit remediation: sintassi e regole critiche verificate.');
